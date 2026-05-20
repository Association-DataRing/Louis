import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Compétences réutilisables qu'un utilisateur peut activer pour son
 * cabinet. Une skill est un bloc { name, description, system_prompt,
 * trigger_hint } que l'orchestrateur peut injecter à la volée dans le
 * system prompt quand l'IA détecte que la skill est pertinente pour la
 * demande utilisateur.
 *
 * Différence vs persona / pipeline :
 * - persona = personnalité figée d'un agent dans une pipeline éditée
 * - skill = capacité ponctuelle, auto-activée selon la demande
 * - pipeline = orchestration d'agents séquentielle/parallèle/council
 */
export const skills = pgTable(
  "skills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    /** Indication courte pour l'auto-détection (ex: "demande de rédaction d'acte"). */
    triggerHint: text("trigger_hint").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    isPreset: boolean("is_preset").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("skills_user_slug_idx").on(t.userId, t.slug)]
);

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
