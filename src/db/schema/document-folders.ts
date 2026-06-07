import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const documentFolders = pgTable("document_folders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  parentFolderId: uuid("parent_folder_id").references(
    (): AnyPgColumn => documentFolders.id,
    { onDelete: "cascade" }
  ),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  // Arbre de dossiers : par propriétaire et par parent (traversée du sous-arbre).
  index("document_folders_user_idx").on(t.userId),
  index("document_folders_parent_idx").on(t.parentFolderId),
]);

export type DocumentFolder = typeof documentFolders.$inferSelect;
export type NewDocumentFolder = typeof documentFolders.$inferInsert;
