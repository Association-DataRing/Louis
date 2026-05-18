import { nanoid } from "nanoid";
import { DefaultAgent, resolveAgentConstructor } from "./agents";
import type {
  Agent,
  AgentContext,
  AgentDefinition,
  AgentPriorOutput,
  AgentRunResult,
  OrchestratorEvent,
  PipelineConfig,
} from "./types";

/**
 * Writer minimal qu'attendent les méthodes de l'orchestrateur — sous-
 * ensemble du `UIMessageStreamWriter` d'AI SDK v6. On reste sur cette
 * interface réduite pour pouvoir mocker proprement en test.
 */
export interface OrchestratorWriter {
  write: (part: unknown) => void;
  merge: (stream: unknown) => void;
}

export interface OrchestratorRunArgs {
  ctx: AgentContext;
  writer: OrchestratorWriter;
  /**
   * Hook synchrone/async appelé pour chaque event émis — typiquement
   * utilisé par la route pour persister un agent_run au moment où
   * l'événement tombe.
   */
  onEvent?: (event: OrchestratorEvent) => Promise<void> | void;
  /** Permet d'injecter une factory custom (tests). */
  agentFactory?: (def: AgentDefinition) => Agent;
}

/**
 * Map AgentDefinition → instance Agent. v0.2 supporte default-chat ;
 * les rôles dédiés (research, citator, reviewer, orchestrator) sont
 * branchés au fur et à mesure de leur implémentation. Rôle inconnu →
 * DefaultAgent (dégradation gracieuse plutôt qu'erreur runtime).
 */
export function defaultAgentFactory(def: AgentDefinition): Agent {
  const Ctor = resolveAgentConstructor(def.role);
  return Ctor ? new Ctor(def) : new DefaultAgent(def);
}

const PREVIEW_LIMIT = 240;

function preview(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= PREVIEW_LIMIT) return trimmed;
  return `${trimmed.slice(0, PREVIEW_LIMIT)}…`;
}

/**
 * Orchestrator — exécute une pipeline d'agents séquentiellement.
 *
 * - Agents 0..N-1 (intermédiaires) : on consomme leur stream pour en
 *   extraire le texte, qui est injecté comme `priorOutput` pour les
 *   agents suivants.
 * - Agent N (terminal) : son stream est mergé dans le writer du caller
 *   pour streamer directement la réponse à l'UI.
 *
 * Chaque agent émet `agent_start` / `agent_finish` (ou `agent_error`).
 * Les events transitent à la fois comme `data-agent-event` parts dans le
 * UI message stream (l'UI les filtre pour afficher les halos « qui
 * travaille ») et via le callback `onEvent` (typiquement utilisé pour
 * persister les agent_runs côté serveur).
 */
export class Orchestrator {
  constructor(public readonly pipeline: PipelineConfig) {
    if (this.pipeline.agents.length === 0) {
      throw new Error(
        `Pipeline "${pipeline.slug}" sans agents — impossible à exécuter.`
      );
    }
  }

  async run(args: OrchestratorRunArgs): Promise<void> {
    const { ctx, writer } = args;
    const factory = args.agentFactory ?? defaultAgentFactory;
    const pipelineRunId = ctx.pipelineRunId ?? nanoid();
    const priorOutputs: AgentPriorOutput[] = [...(ctx.priorOutputs ?? [])];

    for (let i = 0; i < this.pipeline.agents.length; i++) {
      const def = this.pipeline.agents[i];
      const isFinal = i === this.pipeline.agents.length - 1;
      const startedAt = Date.now();

      await this.emit(args, writer, {
        type: "agent_start",
        pipelineRunId,
        agentId: def.id,
        role: def.role,
        label: def.label,
        position: i,
      });

      try {
        const agent = factory(def);
        const result = await agent.run({ ...ctx, pipelineRunId, priorOutputs });

        if (isFinal) {
          await this.runFinalAgent({
            args,
            def,
            pipelineRunId,
            result,
            startedAt,
          });
        } else {
          await this.runIntermediateAgent({
            args,
            def,
            pipelineRunId,
            result,
            priorOutputs,
            startedAt,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await this.emit(args, writer, {
          type: "agent_error",
          pipelineRunId,
          agentId: def.id,
          role: def.role,
          label: def.label,
          error: message,
        });
        throw err;
      }
    }
  }

  private async runIntermediateAgent(opts: {
    args: OrchestratorRunArgs;
    def: AgentDefinition;
    pipelineRunId: string;
    result: AgentRunResult;
    priorOutputs: AgentPriorOutput[];
    startedAt: number;
  }): Promise<void> {
    const { args, def, pipelineRunId, result, priorOutputs, startedAt } = opts;
    let text: string;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    if (result.kind === "stream") {
      // Crucial : les streams AI SDK v6 sont pull-based. Si on n'attache
      // pas activement un consommateur, le stream ne tourne pas — et le
      // Promise `.text` ne résout jamais. Pour les agents intermédiaires
      // dont la sortie ne va pas à l'UI, on consomme explicitement avant
      // de lire .text / .usage. Sinon la pipeline pend indéfiniment.
      await result.stream.consumeStream();
      text = await result.stream.text;
      const usage = await result.stream.usage;
      inputTokens = usage?.inputTokens ?? undefined;
      outputTokens = usage?.outputTokens ?? undefined;
    } else {
      text = result.text;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
    }

    priorOutputs.push({
      agentId: def.id,
      role: def.role,
      label: def.label,
      output: text,
    });

    await this.emit(args, args.writer, {
      type: "agent_finish",
      pipelineRunId,
      agentId: def.id,
      role: def.role,
      label: def.label,
      latencyMs: Date.now() - startedAt,
      inputTokens,
      outputTokens,
      preview: preview(text),
    });
  }

  private async runFinalAgent(opts: {
    args: OrchestratorRunArgs;
    def: AgentDefinition;
    pipelineRunId: string;
    result: AgentRunResult;
    startedAt: number;
  }): Promise<void> {
    const { args, def, pipelineRunId, result, startedAt } = opts;

    if (result.kind === "stream") {
      args.writer.merge(result.stream.toUIMessageStream());
      const finalText = await result.stream.text;
      const usage = await result.stream.usage;

      await this.emit(args, args.writer, {
        type: "agent_finish",
        pipelineRunId,
        agentId: def.id,
        role: def.role,
        label: def.label,
        latencyMs: Date.now() - startedAt,
        inputTokens: usage?.inputTokens ?? undefined,
        outputTokens: usage?.outputTokens ?? undefined,
        preview: preview(finalText),
      });
    } else {
      // Cas atypique : un agent terminal qui retourne du texte plutôt qu'un
      // stream (rare, mais permet à un agent calculé non-LLM d'être terminal).
      args.writer.write({
        type: "data-final-text",
        data: { text: result.text },
        transient: false,
      });

      await this.emit(args, args.writer, {
        type: "agent_finish",
        pipelineRunId,
        agentId: def.id,
        role: def.role,
        label: def.label,
        latencyMs: Date.now() - startedAt,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        preview: preview(result.text),
      });
    }
  }

  private async emit(
    args: OrchestratorRunArgs,
    writer: OrchestratorWriter,
    event: OrchestratorEvent
  ): Promise<void> {
    writer.write({
      type: "data-agent-event",
      data: event,
      transient: true,
    });
    if (args.onEvent) {
      await args.onEvent(event);
    }
  }
}
