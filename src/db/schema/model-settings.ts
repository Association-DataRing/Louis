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
 * Préférence par utilisateur sur la disponibilité d'un modèle dans l'app.
 *
 * Approche opt-out : un modèle est ACTIVÉ par défaut (présent dans
 * MODEL_CATALOG côté code). On stocke uniquement les overrides — les
 * modèles désactivés. Permet d'ajouter un nouveau modèle au catalogue
 * sans avoir à pousser des rows par défaut pour chaque utilisateur.
 *
 * `providerType` + `modelId` identifie de manière unique un modèle. Le
 * couple est indexé pour des lookups O(1) au moment de filtrer les
 * pickers.
 */
export const modelSettings = pgTable(
  "model_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerType: text("provider_type").notNull(),
    modelId: text("model_id").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("model_settings_user_provider_model_idx").on(
      t.userId,
      t.providerType,
      t.modelId
    ),
  ]
);

export type ModelSetting = typeof modelSettings.$inferSelect;
export type NewModelSetting = typeof modelSettings.$inferInsert;
