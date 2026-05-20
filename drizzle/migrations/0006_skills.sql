-- v0.5 — Skills : compétences réutilisables auto-détectées par l'IA.
-- Une skill = (name, description, system_prompt, trigger_hint).
-- Activable/désactivable. Préset système ou perso utilisateur.

CREATE TABLE IF NOT EXISTS "skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "trigger_hint" text NOT NULL,
  "system_prompt" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "is_preset" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "skills_user_slug_idx"
  ON "skills" ("user_id", "slug");
