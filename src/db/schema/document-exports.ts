import {
  pgTable,
  uuid,
  text,
  timestamp,
  customType,
} from "drizzle-orm/pg-core";
import { users } from "./users";

const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Documents générés / édités (DOCX/PDF) en attente de téléchargement.
 *
 * Stockage en DB plutôt qu'en mémoire process — l'app peut tourner en
 * environnement serverless (Vercel) où chaque invocation a un Map vide.
 * TTL géré par `expires_at` + cleanup paresseux à chaque insert.
 */
export const documentExports = pgTable("document_exports", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export type DocumentExport = typeof documentExports.$inferSelect;
