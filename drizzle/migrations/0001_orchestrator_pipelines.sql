-- v0.2 — Orchestrateur multi-agents : ajoute les tables pipelines,
-- pipeline_agents, agent_runs. Idempotent (IF NOT EXISTS) pour pouvoir
-- s'appliquer aussi bien sur un dev qui a déjà fait `db:push` que sur
-- une prod fraîche.

CREATE TABLE IF NOT EXISTS "pipelines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "is_preset" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "pipelines_user_slug_unique"
  ON "pipelines" ("user_id", "slug");
CREATE INDEX IF NOT EXISTS "pipelines_user_idx"
  ON "pipelines" ("user_id");

CREATE TABLE IF NOT EXISTS "pipeline_agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pipeline_id" uuid NOT NULL REFERENCES "pipelines"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "label" text NOT NULL,
  "provider_key_id" uuid REFERENCES "provider_keys"("id") ON DELETE SET NULL,
  "model_override" text,
  "system_prompt" text,
  "tool_allowlist" jsonb,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "pipeline_agents_pipeline_idx"
  ON "pipeline_agents" ("pipeline_id", "position");

CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL
    REFERENCES "conversations"("id") ON DELETE CASCADE,
  "message_id" uuid REFERENCES "messages"("id") ON DELETE SET NULL,
  "pipeline_id" uuid REFERENCES "pipelines"("id") ON DELETE SET NULL,
  "pipeline_agent_id" uuid REFERENCES "pipeline_agents"("id") ON DELETE SET NULL,
  "role" text NOT NULL,
  "label" text NOT NULL,
  "model_id" text,
  "provider_type" text,
  "status" text NOT NULL,
  "input_tokens" integer,
  "output_tokens" integer,
  "latency_ms" integer,
  "error" text,
  "output" text,
  "started_at" timestamp NOT NULL DEFAULT now(),
  "finished_at" timestamp
);

CREATE INDEX IF NOT EXISTS "agent_runs_conversation_idx"
  ON "agent_runs" ("conversation_id");
CREATE INDEX IF NOT EXISTS "agent_runs_pipeline_idx"
  ON "agent_runs" ("pipeline_id");
