"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { generateText, Output, type LanguageModel } from "ai";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  documents,
  tabularReviews,
  tabularReviewRows,
  type ReviewColumn,
} from "@/db/schema";
import { loadProviderKey, modelFromKey } from "@/lib/providers/factory";
import { log } from "@/lib/log";
import { nanoid } from "nanoid";

const EXTRACTION_CONCURRENCY = 3;

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const columnSchema = z.object({
  label: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(500),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  providerKeyId: z.uuid(),
  modelId: z.string().min(1),
  columns: z.array(columnSchema).min(1).max(20),
  documentIds: z.array(z.uuid()).min(0).max(200),
});

export async function createTabularReview(
  rawInput: {
    name: string;
    providerKeyId: string;
    modelId: string;
    columns: Array<{ label: string; prompt: string }>;
    documentIds: string[];
  }
): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = createSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Champs invalides." };
  }

  const columns: ReviewColumn[] = parsed.data.columns.map((c) => ({
    id: nanoid(8),
    label: c.label,
    prompt: c.prompt,
  }));

  const [review] = await db
    .insert(tabularReviews)
    .values({
      userId,
      name: parsed.data.name,
      providerKeyId: parsed.data.providerKeyId,
      modelId: parsed.data.modelId,
      columns,
    })
    .returning({ id: tabularReviews.id });

  if (parsed.data.documentIds.length > 0) {
    await db.insert(tabularReviewRows).values(
      parsed.data.documentIds.map((docId) => ({
        reviewId: review.id,
        documentId: docId,
      }))
    );
  }

  revalidatePath("/tabular-reviews");
  return { ok: true, id: review.id };
}

export async function deleteTabularReview(id: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .delete(tabularReviews)
    .where(
      and(eq(tabularReviews.id, id), eq(tabularReviews.userId, userId))
    );
  revalidatePath("/tabular-reviews");
  redirect("/tabular-reviews");
}

export async function deleteReviewRow(rowId: string): Promise<void> {
  const userId = await requireUserId();
  const [row] = await db
    .select({ reviewId: tabularReviewRows.reviewId })
    .from(tabularReviewRows)
    .innerJoin(
      tabularReviews,
      eq(tabularReviews.id, tabularReviewRows.reviewId)
    )
    .where(
      and(
        eq(tabularReviewRows.id, rowId),
        eq(tabularReviews.userId, userId)
      )
    )
    .limit(1);
  if (!row) return;
  await db.delete(tabularReviewRows).where(eq(tabularReviewRows.id, rowId));
  revalidatePath(`/tabular-reviews/${row.reviewId}`);
}

/**
 * Lance l'extraction pour toutes les lignes pending/error d'un review.
 *
 * Le server action retourne dès que les lignes ont été marquées "running" :
 * le travail réel est planifié via `after()` et s'exécute en parallèle
 * (concurrency = EXTRACTION_CONCURRENCY) après que la réponse HTTP soit
 * partie. Le client poll ensuite via un auto-refresh tant que des lignes
 * restent en "running".
 */
export async function runTabularReview(reviewId: string): Promise<void> {
  const userId = await requireUserId();

  const [review] = await db
    .select()
    .from(tabularReviews)
    .where(
      and(
        eq(tabularReviews.id, reviewId),
        eq(tabularReviews.userId, userId)
      )
    )
    .limit(1);

  if (!review) return;
  if (!review.providerKeyId || !review.modelId) return;
  if (!review.columns || review.columns.length === 0) return;

  // Snapshot des lignes à traiter, en une seule update pour libérer le
  // request handler immédiatement.
  const rowsToProcess = await db
    .update(tabularReviewRows)
    .set({ status: "running", error: null, updatedAt: new Date() })
    .where(
      and(
        eq(tabularReviewRows.reviewId, reviewId),
        inArray(tabularReviewRows.status, ["pending", "error"])
      )
    )
    .returning({
      id: tabularReviewRows.id,
      documentId: tabularReviewRows.documentId,
    });

  revalidatePath(`/tabular-reviews/${reviewId}`);

  if (rowsToProcess.length === 0) return;

  // Capture des références sérialisables — on ne ferme pas sur des objets
  // liés à la requête courante.
  const providerKeyId = review.providerKeyId;
  const modelId = review.modelId;
  const columns = review.columns;

  after(async () => {
    try {
      await processReviewRows({
        userId,
        reviewId,
        providerKeyId,
        modelId,
        columns,
        rows: rowsToProcess,
      });
    } catch (err) {
      log.error("tabular-reviews", "background job failed", {
        error: err instanceof Error ? err.message : err,
      });
    }
  });
}

async function processReviewRows({
  userId,
  reviewId,
  providerKeyId,
  modelId,
  columns,
  rows,
}: {
  userId: string;
  reviewId: string;
  providerKeyId: string;
  modelId: string;
  columns: ReviewColumn[];
  rows: Array<{ id: string; documentId: string }>;
}): Promise<void> {
  const key = await loadProviderKey(userId, providerKeyId);
  const model = modelFromKey(key, modelId);

  const valuesSchema = z.object(
    Object.fromEntries(
      columns.map((c) => [c.id, z.string().describe(c.prompt)])
    )
  );

  // Concurrency limiter — une "fenêtre coulissante" de N promesses en vol.
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(EXTRACTION_CONCURRENCY, rows.length) },
    async () => {
      while (true) {
        const index = cursor++;
        if (index >= rows.length) return;
        await extractRow({ userId, model, valuesSchema, row: rows[index] });
        // Touche très ponctuelle de revalidation — pas à chaque ligne, pour
        // limiter le bruit serveur si la concurrency est élevée.
        if (index % EXTRACTION_CONCURRENCY === 0) {
          revalidatePath(`/tabular-reviews/${reviewId}`);
        }
      }
    }
  );

  await Promise.all(workers);
  revalidatePath(`/tabular-reviews/${reviewId}`);
}

async function extractRow({
  userId,
  model,
  valuesSchema,
  row,
}: {
  userId: string;
  model: LanguageModel;
  valuesSchema: z.ZodObject<Record<string, z.ZodString>>;
  row: { id: string; documentId: string };
}): Promise<void> {
  const [doc] = await db
    .select({
      filename: documents.filename,
      extractedText: documents.extractedText,
    })
    .from(documents)
    .where(and(eq(documents.id, row.documentId), eq(documents.userId, userId)))
    .limit(1);

  if (!doc || !doc.extractedText) {
    await db
      .update(tabularReviewRows)
      .set({
        status: "error",
        error: "Texte non extrait pour ce document.",
        updatedAt: new Date(),
      })
      .where(eq(tabularReviewRows.id, row.id));
    return;
  }

  const promptDoc = doc.extractedText.slice(0, 80_000); // garde-fou contexte

  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: valuesSchema }),
      system:
        "Tu es un analyste juridique. Pour chaque colonne, extrais la valeur depuis le document fourni. Si l'information est absente, réponds par la chaîne \"non spécifié\". Sois bref : 1 à 2 phrases max par valeur.",
      prompt: `Document : "${doc.filename}"\n\n${promptDoc}\n\nExtrais les valeurs demandées par les descriptions des champs.`,
    });

    await db
      .update(tabularReviewRows)
      .set({
        values: result.output as Record<string, string>,
        status: "ok",
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(tabularReviewRows.id, row.id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    await db
      .update(tabularReviewRows)
      .set({
        status: "error",
        error: msg.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(tabularReviewRows.id, row.id));
  }
}

// ---------------------------------------------------------------------------
// Column edition
// ---------------------------------------------------------------------------

const columnFormatSchema = z.enum([
  "text",
  "bulleted_list",
  "date",
  "money",
  "boolean",
]);

const updateColumnSchema = z.object({
  label: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(500),
  format: columnFormatSchema.optional(),
});

/**
 * Met à jour le libellé / prompt / format d'une colonne d'analyse tabulaire.
 * Les colonnes sont stockées en jsonb sur la review, donc on lit, on
 * patche le tableau, puis on réécrit l'ensemble. Idempotent.
 *
 * Ne touche pas aux valeurs déjà extraites — si l'utilisateur modifie le
 * prompt, il devra relancer l'extraction depuis l'UI pour mettre à jour
 * les cellules.
 */
export async function updateReviewColumn(
  reviewId: string,
  columnId: string,
  patch: { label: string; prompt: string; format?: string }
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = updateColumnSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const [review] = await db
    .select({
      id: tabularReviews.id,
      userId: tabularReviews.userId,
      columns: tabularReviews.columns,
    })
    .from(tabularReviews)
    .where(eq(tabularReviews.id, reviewId))
    .limit(1);
  if (!review || review.userId !== userId) {
    return { ok: false, error: "Analyse introuvable." };
  }

  const idx = review.columns.findIndex((c) => c.id === columnId);
  if (idx < 0) return { ok: false, error: "Colonne introuvable." };

  const nextColumns: ReviewColumn[] = review.columns.map((c, i) =>
    i === idx
      ? {
          ...c,
          label: parsed.data.label,
          prompt: parsed.data.prompt,
          format: parsed.data.format as ReviewColumn["format"],
        }
      : c
  );

  await db
    .update(tabularReviews)
    .set({ columns: nextColumns, updatedAt: new Date() })
    .where(eq(tabularReviews.id, reviewId));

  revalidatePath(`/tabular-reviews/${reviewId}`);
  return { ok: true };
}

/**
 * Supprime une colonne d'analyse. Retire aussi les valeurs déjà extraites
 * pour cette colonne dans toutes les lignes — sinon des clés orphelines
 * s'accumulent dans le jsonb `values` des rows.
 */
export async function deleteReviewColumn(
  reviewId: string,
  columnId: string
): Promise<ActionResult> {
  const userId = await requireUserId();

  const [review] = await db
    .select({
      id: tabularReviews.id,
      userId: tabularReviews.userId,
      columns: tabularReviews.columns,
    })
    .from(tabularReviews)
    .where(eq(tabularReviews.id, reviewId))
    .limit(1);
  if (!review || review.userId !== userId) {
    return { ok: false, error: "Analyse introuvable." };
  }
  if (review.columns.length <= 1) {
    return {
      ok: false,
      error: "Une analyse doit avoir au moins une colonne.",
    };
  }

  const nextColumns = review.columns.filter((c) => c.id !== columnId);

  await db
    .update(tabularReviews)
    .set({ columns: nextColumns, updatedAt: new Date() })
    .where(eq(tabularReviews.id, reviewId));

  // Nettoie les valeurs orphelines des rows. Le jsonb n'a pas d'opérateur
  // Drizzle pour DELETE d'une clé, on charge les rows puis on re-set.
  const rowsAffected = await db
    .select({
      id: tabularReviewRows.id,
      values: tabularReviewRows.values,
    })
    .from(tabularReviewRows)
    .where(eq(tabularReviewRows.reviewId, reviewId));

  for (const row of rowsAffected) {
    if (!row.values || !(columnId in row.values)) continue;
    const { [columnId]: _removed, ...rest } = row.values;
    void _removed;
    await db
      .update(tabularReviewRows)
      .set({ values: rest, updatedAt: new Date() })
      .where(eq(tabularReviewRows.id, row.id));
  }

  revalidatePath(`/tabular-reviews/${reviewId}`);
  return { ok: true };
}
