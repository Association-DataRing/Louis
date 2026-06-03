-- Mémoire persistante PAR DOSSIER (matter-scoped). Chaque fait porte sa
-- provenance (source_message_id) et nécessite une validation humaine
-- (status='approved') avant d'influencer une réponse. Cf. lib/memory-extract.ts
-- et l'écran /settings/memory.

CREATE TABLE IF NOT EXISTS "project_memories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "category" text NOT NULL,
  "text" text NOT NULL,
  "source_message_id" uuid REFERENCES "messages"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "project_memories_project_idx"
  ON "project_memories" ("project_id", "status");
