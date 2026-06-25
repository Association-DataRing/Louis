import {
  streamText,
  stepCountIs,
  convertToModelMessages,
  type StopCondition,
  type ToolSet,
} from "ai";
import { loadProviderKey, modelFromKey } from "@/lib/providers/factory";
import { instrumentTools } from "@/lib/observability/tools";
import { withApprovalGates } from "@/lib/ai/approval";
import { loadAgentCatalogue } from "../tool-catalogue";
import { composeSystem, filterTools } from "./default";
import { injectUntrustedContext } from "../untrusted";
import { applyContextBudget } from "../context-budget";
import { applyCachedSystem } from "../provider-tuning";
import { resolveAgentRag, omitDocumentaryRagTools } from "./rag-scope";
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
  const modelMessages = applyContextBudget(
    injectUntrustedContext(await convertToModelMessages(ctx.messages), ctx)
  );

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
    const { scope, hideDocumentaryRag } = await resolveAgentRag(
      ctx,
      def.ragScope
    );
    const { connectorTools, mcpTools } = await loadAgentCatalogue(
      ctx.userId,
      scope,
      ctx.toolCatalogue
    );
    let merged: ToolSet = { ...connectorTools, ...mcpTools };
    if (hideDocumentaryRag) merged = omitDocumentaryRagTools(merged);
    tools = withApprovalGates(
      instrumentTools(filterTools(merged, allowlist), ctx.userId),
      ctx.requestToolApproval
    );
  }

  // Outils injectés par l'orchestrateur (mode maestro : les agents de
  // l'équipe). Hors allowlist et hors instrumentation : leur execute émet
  // déjà les événements agent_start/finish vers l'UI et l'audit.
  if (ctx.extraTools) {
    tools = { ...tools, ...ctx.extraTools };
  }

  const stopWhen: StopCondition<ToolSet> = stepCountIs(
    ctx.maxStepsOverride ?? defaults.maxSteps ?? 3
  );

  const cached = applyCachedSystem({
    keyType: key.type,
    system,
    messages: modelMessages,
    hasTools: Object.keys(tools).length > 0,
  });

  const stream = streamText({
    model,
    system: cached.system,
    messages: cached.messages,
    tools,
    stopWhen,
    temperature: def.temperature ?? undefined,
    abortSignal: ctx.abortSignal,
  });

  return { kind: "stream", stream };
}
