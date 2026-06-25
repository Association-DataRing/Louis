import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
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
  // Alimente l'injection en prompt système ET le RAG (chunking + embeddings +
  // pgvector), en production — cf. lib/rag/*.
  extractedText: text("extracted_text"),
  // Format de `extracted_text` : "markdown" pour les PDF (convertis via
  // lib/pdf/to-markdown ou OCR) et tout doc à structure reconstruite, "text"
  // pour le brut (DOCX/texte, et anciens PDF importés avant la conversion MD).
  // Le DocPanel s'en sert pour rendre le Markdown plutôt que du texte plat.
  textFormat: text("text_format").notNull().default("text"),
  extractionStatus: text("extraction_status").notNull().default("pending"),
  extractionError: text("extraction_error"),
  // ADR 0005 — chiffrement à enveloppe (Phase 1)
  // encDek : DEK 32 bytes enveloppée par la master key AES-GCM (JSON EncryptedBlob).
  // Null = document antérieur au chiffrement (compatibilité ascendante).
  encDek: text("enc_dek"),
  dekNonce: text("dek_nonce"),           // base64, nonce XChaCha du blob S3
  encExtractedText: text("enc_extracted_text"),  // base64 ciphertext XChaCha du texte
  extractedTextNonce: text("extracted_text_nonce"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  // Arbre /documents + familles de versions : filtrés par propriétaire,
  // dossier, et document racine (lookup version au /save).
  index("documents_user_idx").on(t.userId),
  index("documents_folder_idx").on(t.folderId),
  index("documents_parent_idx").on(t.parentDocumentId),
]);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
