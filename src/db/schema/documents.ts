import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { projects } from "./projects";
import { documentFolders } from "./document-folders";

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  folderId: uuid("folder_id").references(() => documentFolders.id, {
    onDelete: "set null",
  }),
  // For versioning: every revision (v2, v3, …) points to the original document
  // (v1). Null for originals. Family lookup: rootId = parentDocumentId ?? id.
  parentDocumentId: uuid("parent_document_id").references(
    (): AnyPgColumn => documents.id,
    { onDelete: "cascade" }
  ),
  version: integer("version").notNull().default(1),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull(),
  // PDF rendu via LibreOffice utilisé pour la preview fidèle dans le
  // DocPanel. Null pour les uploads non-DOCX, ou si LibreOffice n'est pas
  // disponible côté serveur (auquel cas on retombe sur mammoth HTML).
  previewStorageKey: text("preview_storage_key"),
  // Extracted plain text — capped at ~500KB to stay within typical LLM context.
  // Larger documents would need RAG (chunking + embeddings), not implemented yet.
  extractedText: text("extracted_text"),
  extractionStatus: text("extraction_status").notNull().default("pending"),
  extractionError: text("extraction_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
