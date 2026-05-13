"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { generateObject } from "ai";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  documents,
  tabularReviews,
  tabularReviewRows,
  type ReviewColumn,
} from "@/db/schema";
import { loadProviderKey, modelFromKey } from "@/lib/providers/factory";
import { nanoid } from "nanoid";

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
  providerKeyId: z.string().uuid(),
  modelId: z.string().min(1),
  columns: z.array(columnSchema).min(1).max(20),
  documentIds: z.array(z.string().uuid()).min(0).max(200),
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
 * Synchrone (boucle pour chaque doc) — pas idéal pour 100+ docs mais OK
 * en v0.1 sur des reviews de quelques dizaines de fichiers.
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

  const key = await loadProviderKey(userId, review.providerKeyId);
  const model = modelFromKey(key, review.modelId);

  const rows = await db
    .select({
      id: tabularReviewRows.id,
      documentId: tabularReviewRows.documentId,
      status: tabularReviewRows.status,
    })
    .from(tabularReviewRows)
    .where(
      and(
        eq(tabularReviewRows.reviewId, reviewId),
        inArray(tabularReviewRows.status, ["pending", "error"])
      )
    );

  // Schéma Zod construit dynamiquement à partir des colonnes du review.
  const valuesSchema = z.object(
    Object.fromEntries(
      review.columns.map((c) => [c.id, z.string().describe(c.prompt)])
    )
  );

  for (const row of rows) {
    await db
      .update(tabularReviewRows)
      .set({ status: "running", error: null, updatedAt: new Date() })
      .where(eq(tabularReviewRows.id, row.id));
    revalidatePath(`/tabular-reviews/${reviewId}`);

    const [doc] = await db
      .select({
        filename: documents.filename,
        extractedText: documents.extractedText,
      })
      .from(documents)
      .where(
        and(
          eq(documents.id, row.documentId),
          eq(documents.userId, userId)
        )
      )
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
      continue;
    }

    const promptDoc = doc.extractedText.slice(0, 80_000); // garde-fou contexte

    try {
      const result = await generateObject({
        model,
        schema: valuesSchema,
        system:
          "Tu es un analyste juridique. Pour chaque colonne, extrais la valeur depuis le document fourni. Si l'information est absente, réponds par la chaîne \"non spécifié\". Sois bref : 1 à 2 phrases max par valeur.",
        prompt: `Document : "${doc.filename}"\n\n${promptDoc}\n\nExtrais les valeurs demandées par les descriptions des champs.`,
      });

      const values = result.object as Record<string, string>;

      await db
        .update(tabularReviewRows)
        .set({
          values,
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

    revalidatePath(`/tabular-reviews/${reviewId}`);
  }
}
