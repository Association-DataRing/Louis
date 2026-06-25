-- Télémétrie d'exécution des outils (connecteurs + MCP) : latence et
-- succès/échec PAR appel. Distinct de l'audit de conformité (audit_log) ; ici
-- on répond à « quel outil rame ou échoue, et à quelle fréquence ». Alimente
-- la section « Fiabilité des outils » de /settings/usage. Enregistrement
-- best-effort, scopé par utilisateur (null = contexte système).
-- Cf. lib/observability/tools.ts et lib/observability/query.ts.

CREATE TABLE IF NOT EXISTS "tool_invocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "tool_name" text NOT NULL,
  "category" text NOT NULL,
  "success" boolean NOT NULL,
  "error_reason" text,
  "duration_ms" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Agrégats « par outil sur la période » (page usage).
CREATE INDEX IF NOT EXISTS "tool_invocations_name_created_idx"
  ON "tool_invocations" ("tool_name", "created_at");

-- Filtre « appels récents » + nettoyage par rétention.
CREATE INDEX IF NOT EXISTS "tool_invocations_created_idx"
  ON "tool_invocations" ("created_at");
