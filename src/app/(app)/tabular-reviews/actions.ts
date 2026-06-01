"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
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

// H15-f : au-delà de ce délai, une ligne « running » est considérée comme
// abandonnée (after() interrompu : redéploiement, crash, serverless qui
// coupe) et requalifiée pour redevenir relançable.
const STALE_RUNNING_MS = 5 * 60_000;

/**
 * H15-e : intègre le `format` de colonne dans la description du champ
 * d'extraction, pour que le modèle produise des valeurs au bon format.
 */
function describeColumn(c: ReviewColumn): string {
  switch (c.format) {
    case "date":
      return `${c.prompt} (si une date est trouvée, réponds au format JJ/MM/AAAA)`;
    case "money":
      return `${c.prompt} (réponds par un montant avec sa devise, ex. « 12 500 € »)`;
    case "boolean":
      return `${c.prompt} (réponds uniquement par « Oui » ou « Non »)`;
    case "bulleted_list":
      return `${c.prompt} (réponds par une liste à puces, un élément par ligne)`;
    default:
      return c.prompt;
  }
}

function buildValuesSchema(columns: ReviewColumn[]) {
  return z.object(
    Object.fromEntries(
      columns.map((c) => [c.id, z.string().describe(describeColumn(c))])
    )
  );
}

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
 * H15-a : ré-extrait UNE ligne (toutes ses colonnes), même si elle était déjà
 * « ok ». Utile pour relancer un document dont l'extraction a déçu, sans
 * toucher aux autres lignes.
 */
export async function rerunReviewRow(rowId: string): Promise<void> {
  const userId = await requireUserId();
  const [row] = await db
    .select({
      reviewId: tabularReviewRows.reviewId,
      documentId: tabularReviewRows.documentId,
      providerKeyId: tabularReviews.providerKeyId,
      modelId: tabularReviews.modelId,
      columns: tabularReviews.columns,
    })
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
  if (!row || !row.providerKeyId || !row.modelId || !row.columns?.length) return;

  await db
    .update(tabularReviewRows)
    .set({ status: "running", error: null, updatedAt: new Date() })
    .where(eq(tabularReviewRows.id, rowId));
  revalidatePath(`/tabular-reviews/${row.reviewId}`);

  const { reviewId, documentId, providerKeyId, modelId, columns } = row;
  after(async () => {
    try {
      await processReviewRows({
        userId,
        reviewId,
        providerKeyId,
        modelId,
        columns,
        rows: [{ id: rowId, documentId }],
      });
    } catch (err) {
      log.error("tabular-reviews", "rerun row failed", {
        error: err instanceof Error ? err.message : err,
      });
    }
  });
}

/**
 * H15-b : ré-extrait UNE colonne sur toutes les lignes — à déclencher après
 * avoir modifié son prompt. Le merge dans extractRow préserve les valeurs des
 * autres colonnes.
 */
export async function rerunReviewColumn(
  reviewId: string,
  columnId: string
): Promise<ActionResult> {
  const userId = await requireUserId();
  const [review] = await db
    .select()
    .from(tabularReviews)
    .where(
      and(eq(tabularReviews.id, reviewId), eq(tabularReviews.userId, userId))
    )
    .limit(1);
  if (!review) return { ok: false, error: "Analyse introuvable." };
  if (!review.providerKeyId || !review.modelId) {
    return { ok: false, error: "Configuration du modèle incomplète." };
  }
  const col = review.columns.find((c) => c.id === columnId);
  if (!col) return { ok: false, error: "Colonne introuvable." };

  const rows = await db
    .update(tabularReviewRows)
    .set({ status: "running", error: null, updatedAt: new Date() })
    .where(eq(tabularReviewRows.reviewId, reviewId))
    .returning({
      id: tabularReviewRows.id,
      documentId: tabularReviewRows.documentId,
    });
  revalidatePath(`/tabular-reviews/${reviewId}`);
  if (rows.length === 0) return { ok: true };

  const { providerKeyId, modelId } = review;
  after(async () => {
    try {
      await processReviewRows({
        userId,
        reviewId,
        providerKeyId,
        modelId,
        columns: [col],
        rows,
      });
    } catch (err) {
      log.error("tabular-reviews", "rerun column failed", {
        error: err instanceof Error ? err.message : err,
      });
    }
  });
  return { ok: true };
}

const addDocsSchema = z.object({
  documentIds: z.array(z.uuid()).min(1).max(200),
});

/**
 * H15-c : ajoute des documents à une analyse existante (la promesse « vous
 * pourrez en ajouter plus tard »). N'insère que les documents de
 * l'utilisateur avec du texte extrait ; pas de doublon (index unique).
 */
export async function addReviewDocuments(
  reviewId: string,
  documentIds: string[]
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = addDocsSchema.safeParse({ documentIds });
  if (!parsed.success) return { ok: false, error: "Sélection invalide." };

  const [review] = await db
    .select({ id: tabularReviews.id })
    .from(tabularReviews)
    .where(
      and(eq(tabularReviews.id, reviewId), eq(tabularReviews.userId, userId))
    )
    .limit(1);
  if (!review) return { ok: false, error: "Analyse introuvable." };

  const validDocs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        inArray(documents.id, parsed.data.documentIds),
        isNotNull(documents.extractedText)
      )
    );
  if (validDocs.length === 0) {
    return {
      ok: false,
      error: "Aucun document éligible (texte non extrait ?).",
    };
  }

  await db
    .insert(tabularReviewRows)
    .values(validDocs.map((d) => ({ reviewId, documentId: d.id })))
    .onConflictDoNothing();

  revalidatePath(`/tabular-reviews/${reviewId}`);
  return { ok: true };
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

  // H15-f : requalifie d'abord les lignes « running » abandonnées (au-delà du
  // seuil) en « error », pour qu'elles soient reprises par l'update suivant.
  // Les « running » récentes (run légitime en cours) ne sont pas touchées.
  await db
    .update(tabularReviewRows)
    .set({
      status: "error",
      error: "Traitement interrompu — relancé.",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tabularReviewRows.reviewId, reviewId),
        eq(tabularReviewRows.status, "running"),
        lt(tabularReviewRows.updatedAt, new Date(Date.now() - STALE_RUNNING_MS))
      )
    );

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

  const valuesSchema = buildValuesSchema(columns);

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

    // Merge (pas overwrite) : préserve les valeurs des AUTRES colonnes — clé
    // pour la ré-extraction d'une seule colonne (H15-b). Pour un run complet,
    // les valeurs de départ sont vides, donc merge = set.
    const [existing] = await db
      .select({ values: tabularReviewRows.values })
      .from(tabularReviewRows)
      .where(eq(tabularReviewRows.id, row.id))
      .limit(1);
    await db
      .update(tabularReviewRows)
      .set({
        values: {
          ...(existing?.values ?? {}),
          ...(result.output as Record<string, string>),
        },
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
