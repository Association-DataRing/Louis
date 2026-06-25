import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { providerKeys } from "./provider-keys";

/**
 * Préférence d'OCR par utilisateur (au plus une ligne). L'absence de ligne =
 * mode `auto` : Louis choisit la meilleure voie disponible (Mistral OCR dédié
 * → OCR par modèle de vision via une clé dispo → Tesseract local souverain).
 *
 * L'utilisateur peut forcer un moteur précis :
 * - `mistral`   : endpoint OCR dédié de Mistral (`/v1/ocr`), nécessite une clé Mistral.
 * - `vision`    : OCR par modèle multimodal de SON choix (providerKeyId + modelId)
 *                 — n'importe quel provider vision-capable (OpenRouter/OpenAI/…).
 * - `tesseract` : OCR 100 % local, gratuit, hors-ligne.
 */
export const ocrSettings = pgTable("ocr_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  // "auto" | "mistral" | "vision" | "tesseract"
  mode: text("mode").notNull().default("auto"),
  // Pour le mode "vision" : la clé provider et le modèle multimodal à utiliser.
  providerKeyId: uuid("provider_key_id").references(() => providerKeys.id, {
    onDelete: "set null",
  }),
  modelId: text("model_id"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type OcrSetting = typeof ocrSettings.$inferSelect;
export type NewOcrSetting = typeof ocrSettings.$inferInsert;
