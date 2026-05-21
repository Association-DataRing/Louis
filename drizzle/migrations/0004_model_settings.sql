-- v0.4 — Préférences modèles par utilisateur.
-- Approche opt-out : un modèle est ACTIVÉ par défaut, on stocke
-- uniquement les modèles explicitement désactivés. Permet d'ajouter de
-- nouveaux modèles au catalogue sans backfill par utilisateur.

CREATE TABLE IF NOT EXISTS "model_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider_type" text NOT NULL,
  "model_id" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "model_settings_user_provider_model_idx"
  ON "model_settings" ("user_id", "provider_type", "model_id");
