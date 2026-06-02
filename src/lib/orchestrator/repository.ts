import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { pipelineAgents, pipelines } from "@/db/schema";
import type {
  AgentDefinition,
  AgentRole,
  PipelineConfig,
  PipelineMode,
} from "./types";

const KNOWN_MODES: PipelineMode[] = ["sequential", "council", "parallel"];

function isPipelineMode(value: string): value is PipelineMode {
  return (KNOWN_MODES as string[]).includes(value);
}

const KNOWN_ROLES: AgentRole[] = [
  "default-chat",
  "orchestrator",
  "research",
  "drafting",
  "reviewer",
  "citator",
  "legifrance",
];

function isAgentRole(value: string): value is AgentRole {
  return (KNOWN_ROLES as string[]).includes(value);
}

/**
 * Charge une pipeline appartenant à `userId` et hydrate ses agents avec
 * un fallback `providerKeyId` / `modelOverride` quand l'agent n'a pas
 * sa propre clé/modèle configuré. Retourne null si pas trouvée — la
 * route répond alors 404.
 */
export async function loadPipelineForUser(
  userId: string,
  pipelineId: string,
  fallback: { providerKeyId: string; modelOverride?: string | null }
): Promise<PipelineConfig | null> {
  const [row] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.userId, userId)))
    .limit(1);
  if (!row) return null;

  const agentRows = await db
    .select()
    .from(pipelineAgents)
    .where(eq(pipelineAgents.pipelineId, row.id))
    .orderBy(asc(pipelineAgents.position));

  const agents: AgentDefinition[] = agentRows.map((a) => ({
    id: a.id,
    role: isAgentRole(a.role) ? a.role : "default-chat",
    label: a.label,
    providerKeyId: a.providerKeyId ?? fallback.providerKeyId,
    modelOverride: a.modelOverride ?? fallback.modelOverride ?? null,
    systemPrompt: a.systemPrompt ?? null,
    toolAllowlist: a.toolAllowlist ?? null,
    ragScope: a.ragScope ?? null,
    temperature: a.temperature ?? null,
  }));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    mode: isPipelineMode(row.mode) ? row.mode : "sequential",
    rounds: row.rounds,
    agents,
  };
}
