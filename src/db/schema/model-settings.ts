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
    /**
     * Sémantique opt-in : `true` = modèle ajouté à la plateforme et donc
     * disponible dans les pickers. `false` = explicitement retiré (les
     * legacy rows du système opt-out d'avant gardent leur sens : non
     * disponibles). Le defaut DB est false pour compat, le UX nouveau
     * insert toujours en true.
     */
    enabled: boolean("enabled").notNull().default(false),
    /** Label humain stocké au moment de l'ajout (snapshot). */
    label: text("label"),
    /** Hint optionnel (« Rapide, peu coûteux »…). */
    hint: text("hint"),
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
