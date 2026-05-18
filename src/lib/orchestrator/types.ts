import type { streamText, UIMessage } from "ai";

/**
 * Type retourné par streamText() — utiliser le type inféré garde la
 * compatibilité quand AI SDK fait évoluer ses paramètres génériques.
 */
export type StreamHandle = ReturnType<typeof streamText>;

/**
 * Rôles d'agents reconnus par le runtime. `default-chat` reste le rôle
 * historique (mono-agent v0.1). Les autres rôles sont implémentés en
 * v0.2 pour composer un véritable cabinet d'IA.
 */
export type AgentRole =
  | "default-chat"
  | "orchestrator"
  | "research"
  | "drafting"
  | "reviewer"
  | "citator"
  | "legifrance";

export interface AgentDefinition {
  /** id stable du pipeline_agent (DB) ou id synthétique pour mono-agent. */
  id: string;
  role: AgentRole;
  /** label humain affiché dans /bureau et dans l'audit trail. */
  label: string;
  providerKeyId: string;
  modelOverride?: string | null;
  /**
   * Si défini, remplace le system prompt par défaut du rôle. Sinon le
   * runtime applique le system prompt « factory » du rôle.
   */
  systemPrompt?: string | null;
  /**
   * Sous-ensemble d'outils par nom AI SDK. null/undefined = tous les
   * outils disponibles à l'utilisateur (connecteurs + MCP).
   */
  toolAllowlist?: string[] | null;
}

export interface PipelineConfig {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  /** Agents exécutés dans l'ordre — séquentiel v0.2. */
  agents: AgentDefinition[];
}

/**
 * Contexte d'invocation passé à un agent isolé. Les agents en aval d'une
 * pipeline reçoivent `priorOutputs` pour pouvoir composer leur travail
 * sur celui des agents précédents.
 */
export interface AgentContext {
  userId: string;
  conversationId: string;
  messages: UIMessage[];
  documentIds?: string[];
  systemPromptExtras?: string;
  /** Sortie texte des agents précédents dans la pipeline, dans l'ordre. */
  priorOutputs?: AgentPriorOutput[];
  /** Tag de corrélation pour le tracing. */
  pipelineRunId?: string;
}

export interface AgentPriorOutput {
  agentId: string;
  role: AgentRole;
  label: string;
  output: string;
}

/**
 * Résultat brut d'un agent — soit un stream prêt à être renvoyé (cas
 * mono-agent où l'on streame directement la réponse de l'unique agent),
 * soit un texte collecté (cas multi-agents intermédiaires).
 */
export type AgentRunResult =
  | {
      kind: "stream";
      stream: StreamHandle;
    }
  | {
      kind: "text";
      text: string;
      inputTokens?: number;
      outputTokens?: number;
    };

export interface Agent {
  readonly definition: AgentDefinition;
  run(ctx: AgentContext): Promise<AgentRunResult>;
}

/**
 * Événements émis par le runtime d'orchestration et relayés à l'UI via le
 * UI message stream (channel `data-*`). Chaque event identifie l'agent
 * concerné pour que /bureau et le chat puissent allumer le bon "halo".
 */
export type OrchestratorEvent =
  | {
      type: "agent_start";
      pipelineRunId: string;
      agentId: string;
      role: AgentRole;
      label: string;
      position: number;
    }
  | {
      type: "agent_finish";
      pipelineRunId: string;
      agentId: string;
      role: AgentRole;
      label: string;
      latencyMs: number;
      inputTokens?: number;
      outputTokens?: number;
      preview?: string;
    }
  | {
      type: "agent_error";
      pipelineRunId: string;
      agentId: string;
      role: AgentRole;
      label: string;
      error: string;
    };

export type OrchestratorEventListener = (event: OrchestratorEvent) => void;
