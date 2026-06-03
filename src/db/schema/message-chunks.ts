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
import { messages } from "./messages";
import { EMBEDDING_DIM } from "./document-chunks";

/**
 * Embeddings des messages de conversation — alimente le RAG sur l'historique
 * d'un projet (cf. lib/rag/message-search.ts). Mêmes dimensions et même
 * index HNSW que document_chunks : seules les conversations rattachées à un
 * projet sont indexées (maîtrise du coût d'embedding).
 */
export const messageChunks = pgTable(
  "message_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("message_chunks_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops")
    ),
    index("message_chunks_message_idx").on(t.messageId),
    // GIN FTS (français) pour la recherche hybride (message-search.ts).
    index("message_chunks_fts_idx").using(
      "gin",
      sql`to_tsvector('french', ${t.content})`
    ),
  ]
);

export type MessageChunk = typeof messageChunks.$inferSelect;
export type NewMessageChunk = typeof messageChunks.$inferInsert;
