import type { streamText, UIMessage } from "ai";
import type { AgentRagScope } from "@/db/schema/pipelines";

export type { AgentRagScope };

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
  /** label humain affiché dans /board et dans l'audit trail. */
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
  /**
   * Portée documentaire RAG propre à l'agent. null/undefined/`inherit` =
   * périmètre de la conversation (comportement historique). Cf. resolveAgentRag.
   */
  ragScope?: AgentRagScope | null;
  /**
   * Température d'échantillonnage. null/undefined = défaut du provider.
   * Bas (~0.2) = factuel/déterministe ; haut (~0.8) = créatif.
   */
  temperature?: number | null;
}

/**
 * Mode d'exécution :
 * - `sequential` : chaîne (A → B → C). Chaque agent voit les sorties précédentes.
 * - `council`    : comité avec N tours de débat. Les N-1 premiers agents
 *                  débattent, le dernier agent synthétise.
 * - `parallel`   : fan-out — tous les agents non-terminaux travaillent en
 *                  parallèle sur la même question, le terminal synthétise.
 * - `iterative`  : approfondissement — le 1er agent (chercheur) reprend ses
 *                  propres notes à chaque tour pour creuser les lacunes, puis
 *                  le terminal produit une note de recherche synthétique.
 */
export type PipelineMode = "sequential" | "council" | "parallel" | "iterative";

export interface PipelineConfig {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  mode?: PipelineMode;
  /** Nombre de tours pour le mode council (1–4 typique). Ignoré sinon. */
  rounds?: number;
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
  /**
   * Ajouts FIABLES au prompt système (instructions d'orchestration : consignes
   * de tour/synthèse du council). NE JAMAIS y mettre de contenu non-fiable
   * (documents joints, compétences, sorties d'agents) — celui-ci passe par
   * `untrustedBlocks`. Cf. lib/orchestrator/untrusted.ts.
   */
  systemPromptExtras?: string;
  /**
   * Contenu NON-FIABLE du tour (documents joints, compétences). Injecté comme
   * message `user` préfixé d'un marqueur, jamais dans le prompt système, pour
   * que le modèle ne puisse pas confondre une instruction cachée dans un
   * document avec une consigne de Louis.
   */
  untrustedBlocks?: UntrustedBlock[];
  /**
   * Périmètre projet de la conversation (modèle dossier = projet). Quand il
   * est présent, les outils documentaires sont scopés aux documents du projet
   * et l'outil de recherche dans l'historique des conversations est activé.
   */
  projectId?: string | null;
  /** IDs des documents du projet (sous-arbre du dossier-racine). */
  projectDocumentIds?: string[];
  /** Dossier-racine du projet — destination des documents générés/édités. */
  projectFolderId?: string | null;
  /** Sortie texte des agents précédents dans la pipeline, dans l'ordre. */
  priorOutputs?: AgentPriorOutput[];
  /** Tag de corrélation pour le tracing. */
  pipelineRunId?: string;
  /**
   * Signal d'annulation propagé depuis la requête HTTP (req.signal). Quand
   * l'utilisateur clique « Stop », le fetch est aborté → ce signal s'abort →
   * propagé jusqu'à streamText pour couper réellement l'appel LLM serveur
   * (et donc la facturation), pas seulement le rendu client.
   */
  abortSignal?: AbortSignal;
}

export interface AgentPriorOutput {
  agentId: string;
  role: AgentRole;
  label: string;
  output: string;
  /** Numéro de tour pour le mode council (1, 2, …). undefined en sequential. */
  round?: number;
}

/** Nature d'une source non-fiable, pour l'étiquetage du bloc injecté. */
export type UntrustedKind = "document" | "skill" | "agent-output" | "memory";

/**
 * Bloc de contenu NON-FIABLE (document joint, compétence, sortie d'agent…).
 * Injecté comme message `user` distinct et préfixé d'un marqueur, jamais dans
 * le prompt système — séparation instruction/donnée. Cf. lib/orchestrator/untrusted.ts.
 */
export interface UntrustedBlock {
  kind: UntrustedKind;
  /** Libellé de la source (nom de fichier, libellé d'agent…) affiché dans l'en-tête. */
  label: string;
  text: string;
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
 * concerné pour que /board et le chat puissent allumer le bon "halo".
 */
export type OrchestratorEvent =
  | {
      type: "agent_start";
      pipelineRunId: string;
      agentId: string;
      role: AgentRole;
      label: string;
      position: number;
      round?: number;
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
      round?: number;
      /**
       * Modèle effectif de CET agent (def.modelOverride). Sert au coût par
       * agent (agent_runs.modelId) : sans lui, l'audit trail recopierait le
       * modèle global au lieu du modèle réellement utilisé par l'agent.
       */
      modelId?: string | null;
    }
  | {
      type: "agent_error";
      pipelineRunId: string;
      agentId: string;
      role: AgentRole;
      label: string;
      error: string;
      round?: number;
      modelId?: string | null;
    };

export type OrchestratorEventListener = (event: OrchestratorEvent) => void;
