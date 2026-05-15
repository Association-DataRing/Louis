import {
  pgTable,
  uuid,
  text,
  timestamp,
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
});

export type DocumentFolder = typeof documentFolders.$inferSelect;
export type NewDocumentFolder = typeof documentFolders.$inferInsert;
