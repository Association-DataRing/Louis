import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { projects } from "./projects";
import { messages } from "./messages";

/**
 * Mémoire persistante PAR DOSSIER (matter-scoped, jamais globale → pas de
 * contamination inter-clients). Chaque fait porte sa provenance
 * (sourceMessageId) et nécessite une VALIDATION humaine (status approved) avant
 * d'influencer une réponse — laisser filtrer un délai/partie appris sans
 * contrôle serait quasi-faute. Cf. lib/orchestrator + api/chat recall.
 */
export const MEMORY_CATEGORIES = [
  "party", // partie / rôle
  "deadline", // échéance / délai
  "convention", // convention de rédaction du cabinet
  "fact", // fait du dossier
  "preference", // préférence de l'utilisateur
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const MEMORY_STATUSES = ["pending", "approved"] as const;
export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

export const projectMemories = pgTable(
  "project_memories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    text: text("text").notNull(),
    sourceMessageId: uuid("source_message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("project_memories_project_idx").on(t.projectId, t.status)]
);

export type ProjectMemory = typeof projectMemories.$inferSelect;
export type NewProjectMemory = typeof projectMemories.$inferInsert;
