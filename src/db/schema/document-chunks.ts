import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  vector,
} from "drizzle-orm/pg-core";
import { documents } from "./documents";

/**
 * 1024 dimensions matches Mistral's `mistral-embed` output size — the
 * default embedding model for Louis. Other providers / dimensions are
 * not supported in v0.1.
 */
export const EMBEDDING_DIM = 1024;

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("document_chunks_embedding_idx")
      .using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("document_chunks_document_idx").on(t.documentId),
    // GIN FTS (français) pour la recherche hybride vecteur+mot-clé (rag/search.ts).
    index("document_chunks_fts_idx").using(
      "gin",
      sql`to_tsvector('french', ${t.content})`
    ),
  ]
);

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
