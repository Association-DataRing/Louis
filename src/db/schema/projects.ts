import {
  pgTable,
  uuid,
  text,
  timestamp,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { documentFolders } from "./document-folders";

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Dossier-racine du projet dans l'arbre /documents. Les documents du
  // projet = ceux rangés dans ce dossier ou un de ses sous-dossiers
  // (cf. lib/projects/scope.ts). Source de vérité de l'appartenance
  // documentaire — documents.projectId n'est plus utilisé pour ça.
  folderId: uuid("folder_id").references(
    (): AnyPgColumn => documentFolders.id,
    { onDelete: "set null" }
  ),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
