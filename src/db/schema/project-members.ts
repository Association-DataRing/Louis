import {
  pgTable,
  uuid,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { projects } from "./projects";

/**
 * Collaborateurs d'un projet (travail collaboratif intra-cabinet). Un projet
 * appartient toujours à un propriétaire unique (`projects.userId`) ; cette
 * table liste les AUTRES comptes du cabinet autorisés à y accéder.
 *
 * MVP « membre = accès complet » : la simple présence d'une ligne donne un
 * accès lecture + écriture au périmètre du projet (conversations + documents
 * du dossier-racine). Pas de niveau de rôle pour l'instant — un grain plus
 * fin (lecteur/éditeur) pourra s'ajouter via une colonne `role` plus tard.
 *
 * Le propriétaire n'a PAS de ligne ici (il est déjà `projects.userId`).
 */
export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Qui a ajouté ce collaborateur (propriétaire ou admin). Conservé pour
    // l'audit ; SET NULL si le compte qui a invité est supprimé.
    addedBy: uuid("added_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    // Un compte ne peut être membre qu'une fois d'un même projet.
    uniqueIndex("project_members_project_user_idx").on(t.projectId, t.userId),
    // « Quels projets me sont partagés ? » (liste projets, sidebar).
    index("project_members_user_idx").on(t.userId),
  ]
);

export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;
