import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, documentChunks } from "@/db/schema";
import { chunkText } from "./chunk";
import { embedTexts, NoEmbeddingProviderError } from "./embed";

export type ReindexResult =
  | { ok: true; chunks: number }
  | {
      ok: false;
      reason: "not_found" | "no_text" | "no_mistral_key" | "error";
      message?: string;
    };

/**
 * (Ré)indexe un document : supprime ses chunks existants puis recalcule
 * chunks + embeddings et les réinsère. Best-effort — l'absence de clé Mistral
 * active est signalée explicitement (`no_mistral_key`) pour alimenter l'UI de
 * transparence RAG. Vérifie la propriété (userId) avant toute opération.
 */
export async function reindexDocument(
  userId: string,
  documentId: string
): Promise<ReindexResult> {
  const [doc] = await db
    .select({ id: documents.id, extractedText: documents.extractedText })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);
  if (!doc) return { ok: false, reason: "not_found" };
  if (!doc.extractedText) return { ok: false, reason: "no_text" };

  const chunks = chunkText(doc.extractedText);
  if (chunks.length === 0) return { ok: false, reason: "no_text" };

  let embeddings: number[][];
  try {
    embeddings = await embedTexts(userId, chunks);
  } catch (err) {
    if (err instanceof NoEmbeddingProviderError) {
      return { ok: false, reason: "no_mistral_key" };
    }
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : "embedding_failed",
    };
  }

  // Remplace l'index existant (idempotent) : on supprime puis réinsère.
  await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId));
  await db.insert(documentChunks).values(
    chunks.map((content, i) => ({
      documentId,
      chunkIndex: i,
      content,
      embedding: embeddings[i],
    }))
  );
  return { ok: true, chunks: chunks.length };
}
