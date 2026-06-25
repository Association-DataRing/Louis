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
 * default sovereign embedding model for Louis (cf. lib/rag/embed.ts), et
 * aussi des backends auto-hébergés recommandés (Qwen3-Embedding-0.6B).
 * Un déploiement qui privilégie OpenAI text-embedding-3-small (1536) ajuste
 * cette valeur et ré-indexe — une seule dimension par déploiement, pas de
 * mélange à chaud. Tous les chunks existants doivent être purgés avant de
 * changer cette valeur.
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
