import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm";
import { db } from "@/db";
import { documents, documentChunks } from "@/db/schema";
import { embedQuery } from "./embed";

export type RagHit = {
  documentId: string;
  filename: string;
  chunkIndex: number;
  content: string;
  similarity: number;
};

/**
 * Vector similarity search over the user's documents.
 * Returns up to `limit` chunks ordered by cosine similarity.
 * When `documentIds` is provided, search is restricted to those documents.
 */
export async function ragSearch(
  userId: string,
  query: string,
  options?: { documentIds?: string[]; limit?: number }
): Promise<RagHit[]> {
  const limit = options?.limit ?? 6;
  const queryEmbedding = await embedQuery(userId, query);

  const baseWhere = options?.documentIds?.length
    ? and(
        eq(documents.userId, userId),
        inArray(documents.id, options.documentIds)
      )
    : eq(documents.userId, userId);

  const similarity = sql<number>`1 - (${cosineDistance(
    documentChunks.embedding,
    queryEmbedding
  )})`;

  const rows = await db
    .select({
      documentId: documentChunks.documentId,
      filename: documents.filename,
      chunkIndex: documentChunks.chunkIndex,
      content: documentChunks.content,
      similarity,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documents.id, documentChunks.documentId))
    .where(baseWhere)
    .orderBy(desc(similarity))
    .limit(limit);

  return rows;
}
