import {
  streamText,
  stepCountIs,
  convertToModelMessages,
  type StopCondition,
  type ToolSet,
} from "ai";
import { loadProviderKey, modelFromKey } from "@/lib/providers/factory";
import { buildToolsForUser, type ToolScope } from "@/lib/connectors/tools";
import { buildMcpToolsForUser } from "@/lib/mcp/tools";
import { composeSystem, filterTools } from "./default";
import type {
  AgentContext,
  AgentDefinition,
  AgentRunResult,
} from "../types";

/**
 * Configuration « factory » d'un rôle d'agent. Chaque agent dédié
 * (Research, Citator, Reviewer, Orchestrator) déclare ses defaults — qui
 * peuvent toujours être overridés par l'utilisateur via l'UI /board
 * (champ systemPrompt, toolAllowlist sur pipeline_agents).
 */
export interface AgentFactoryDefaults {
  systemPrompt: string;
  /**
   * null → tous les outils (comme DefaultAgent).
   * []   → aucun outil (l'agent travaille uniquement sur le texte).
   * [...]→ sous-ensemble explicite (à n'autoriser que ce qui sert au rôle).
   */
  toolAllowlist: string[] | null;
  /** stepCountIs — par défaut 3 pour les agents spécialisés. */
  maxSteps?: number;
}

/**
 * Exécute un agent générique : charge la clé, monte le modèle, applique
 * le system prompt composé et lance streamText. Mutualisé entre tous les
 * agents pour garantir une exécution homogène (gestion d'outils, gestion
 * du provider, etc.) sans dupliquer le boilerplate.
 */
export async function runAgentStream(
  def: AgentDefinition,
  ctx: AgentContext,
  defaults: AgentFactoryDefaults
): Promise<AgentRunResult> {
  const key = await loadProviderKey(ctx.userId, def.providerKeyId);
  const model = modelFromKey(key, def.modelOverride);
  const modelMessages = await convertToModelMessages(ctx.messages);

  const system = composeSystem(defaults.systemPrompt, def, ctx);

  // Le toolAllowlist côté définition utilisateur a la priorité sur le
  // default du rôle (un utilisateur peut élargir l'allowlist d'un agent
  // dans /board).
  const allowlist =
    def.toolAllowlist !== undefined && def.toolAllowlist !== null
      ? def.toolAllowlist
      : defaults.toolAllowlist;

  let tools: ToolSet = {};
  if (allowlist === null || (allowlist && allowlist.length > 0)) {
    const scope: ToolScope | undefined = ctx.projectId
      ? {
          projectId: ctx.projectId,
          conversationId: ctx.conversationId,
          documentIds: ctx.projectDocumentIds ?? [],
          folderId: ctx.projectFolderId ?? null,
        }
      : undefined;
    const [connectorTools, mcpTools] = await Promise.all([
      buildToolsForUser(ctx.userId, scope),
      buildMcpToolsForUser(ctx.userId),
    ]);
    tools = filterTools({ ...connectorTools, ...mcpTools }, allowlist);
  }

  const stopWhen: StopCondition<ToolSet> = stepCountIs(defaults.maxSteps ?? 3);

  const stream = streamText({
    model,
    system,
    messages: modelMessages,
    tools,
    stopWhen,
    abortSignal: ctx.abortSignal,
  });

  return { kind: "stream", stream };
}
