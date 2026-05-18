import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { providerKeys } from "./provider-keys";
import { conversations } from "./conversations";
import { messages } from "./messages";

/**
 * Pipelines = la composition d'agents qu'un utilisateur peut exécuter.
 * `isPreset` distingue les pipelines système clonables (seedés au login)
 * des pipelines créés/clonés par l'utilisateur.
 *
 * Le `slug` est unique par utilisateur (les presets ont un slug stable —
 * "chat-simple", "recherche-juridique"… — pour pouvoir les retrouver en
 * code).
 */
/**
 * Mode d'exécution d'une pipeline :
 * - `sequential` : chaîne classique, chaque agent voit la sortie des précédents
 * - `council`    : comité, N tours où tous les agents (sauf le synthétiseur)
 *                  voient les positions des autres et révisent la leur
 * - `parallel`   : fan-out — le synthétiseur dispatche en parallèle, agrège
 */
export type PipelineMode = "sequential" | "council" | "parallel";

export const pipelines = pgTable(
  "pipelines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isPreset: boolean("is_preset").notNull().default(false),
    mode: text("mode").$type<PipelineMode>().notNull().default("sequential"),
    rounds: integer("rounds").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("pipelines_user_slug_unique").on(t.userId, t.slug),
    index("pipelines_user_idx").on(t.userId),
  ]
);

export type Pipeline = typeof pipelines.$inferSelect;
export type NewPipeline = typeof pipelines.$inferInsert;

/**
 * Agents définis au sein d'un pipeline. L'ordre d'exécution séquentiel
 * est donné par `position`. Le `role` détermine quelle classe Agent
 * est instanciée côté runtime (default-chat, research, citator, reviewer,
 * orchestrator).
 *
 * `toolAllowlist` = null/empty → tous les outils disponibles. Sinon, sous-
 * ensemble (par nom AI SDK : "legifrance_search", "rag_search"…).
 */
export const pipelineAgents = pgTable(
  "pipeline_agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    label: text("label").notNull(),
    providerKeyId: uuid("provider_key_id").references(() => providerKeys.id, {
      onDelete: "set null",
    }),
    modelOverride: text("model_override"),
    systemPrompt: text("system_prompt"),
    toolAllowlist: jsonb("tool_allowlist").$type<string[] | null>(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("pipeline_agents_pipeline_idx").on(t.pipelineId, t.position)]
);

export type PipelineAgent = typeof pipelineAgents.$inferSelect;
export type NewPipelineAgent = typeof pipelineAgents.$inferInsert;

/**
 * Trace d'exécution audit : chaque appel d'agent au sein d'un message
 * d'assistant produit une ligne. Permet d'afficher "qui a fait quoi" dans
 * la conversation et d'apporter un audit trail opposable au Bâtonnier /
 * DPA / contrôle CNIL.
 */
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    pipelineId: uuid("pipeline_id").references(() => pipelines.id, {
      onDelete: "set null",
    }),
    pipelineAgentId: uuid("pipeline_agent_id").references(
      () => pipelineAgents.id,
      { onDelete: "set null" }
    ),
    role: text("role").notNull(),
    label: text("label").notNull(),
    modelId: text("model_id"),
    providerType: text("provider_type"),
    status: text("status").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    error: text("error"),
    output: text("output"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
  },
  (t) => [
    index("agent_runs_conversation_idx").on(t.conversationId),
    index("agent_runs_pipeline_idx").on(t.pipelineId),
  ]
);

export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;
