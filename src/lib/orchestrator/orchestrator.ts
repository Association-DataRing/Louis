import { nanoid } from "nanoid";
import { DefaultAgent, resolveAgentConstructor } from "./agents";
import { withRetry } from "./retry";
import type {
  Agent,
  AgentContext,
  AgentDefinition,
  AgentPriorOutput,
  AgentRunResult,
  OrchestratorEvent,
  PipelineConfig,
} from "./types";

export interface OrchestratorWriter {
  write: (part: unknown) => void;
  merge: (stream: unknown) => void;
}

export interface OrchestratorRunArgs {
  ctx: AgentContext;
  writer: OrchestratorWriter;
  onEvent?: (event: OrchestratorEvent) => Promise<void> | void;
  agentFactory?: (def: AgentDefinition) => Agent;
}

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
 * Orchestrator — exécute une pipeline selon son mode.
 *
 * Trois stratégies :
 * - sequential : chaîne A → B → C. Chaque agent voit les sorties des
 *                précédents (priorOutputs). Le terminal stream sa réponse.
 * - council    : N tours. Aux tours 1..N-1, tous les agents non-terminaux
 *                répondent en parallèle en voyant les positions du tour
 *                précédent. Au tour final, le terminal synthétise toute la
 *                délibération en streaming.
 * - parallel   : fan-out. Tous les non-terminaux répondent en parallèle
 *                sans se voir, le terminal synthétise.
 *
 * Chaque agent émet `agent_start` / `agent_finish` / `agent_error`. Le
 * dernier agent de la pipeline est l'agent terminal et son stream est
 * mergé dans le writer pour atteindre l'UI directement.
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
    const mode = this.pipeline.mode ?? "sequential";
    if (mode === "council") return this.runCouncil(args);
    if (mode === "parallel") return this.runParallel(args);
    return this.runSequential(args);
  }

  // ─── SEQUENTIAL ─────────────────────────────────────────────────────────

  private async runSequential(args: OrchestratorRunArgs): Promise<void> {
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
        if (isFinal) {
          // Le terminal stream — pas de retry sur le stream lui-même
          // (déjà 3 retries par défaut côté AI SDK). On limite les
          // wrappers pour préserver le streaming UX.
          const agent = factory(def);
          const result = await agent.run({
            ...ctx,
            pipelineRunId,
            priorOutputs,
          });
          await this.streamFinal({
            args,
            def,
            pipelineRunId,
            result,
            startedAt,
          });
        } else {
          // Intermédiaire : retry exponentiel sur erreurs transitoires.
          // L'utilisateur ne perd plus un run multi-agents juste parce
          // que Mistral hoquette pendant 2 secondes.
          const agent = factory(def);
          await withRetry(
            async () => {
              const result = await agent.run({
                ...ctx,
                pipelineRunId,
                priorOutputs,
              });
              return this.consumeIntermediate({
                args,
                def,
                pipelineRunId,
                result,
                priorOutputs,
                startedAt,
              });
            },
            {
              onRetry: async (attempt, delayMs) => {
                writer.write({
                  type: "data-agent-retry",
                  data: {
                    pipelineRunId,
                    agentId: def.id,
                    role: def.role,
                    label: def.label,
                    attempt,
                    delayMs,
                  },
                });
              },
            }
          );
        }
      } catch (err) {
        await this.emitError(args, writer, def, pipelineRunId, err);
        throw err;
      }
    }
  }

  // ─── COUNCIL ───────────────────────────────────────────────────────────

  private async runCouncil(args: OrchestratorRunArgs): Promise<void> {
    const { ctx, writer } = args;
    const factory = args.agentFactory ?? defaultAgentFactory;
    const pipelineRunId = ctx.pipelineRunId ?? nanoid();
    const rounds = Math.max(1, Math.min(this.pipeline.rounds ?? 1, 6));
    const agents = this.pipeline.agents;
    const synthesizer = agents[agents.length - 1];
    const debaters = agents.slice(0, -1);

    // Si pas de débatteurs, on retombe sur du séquentiel (un seul agent).
    if (debaters.length === 0) return this.runSequential(args);

    // priorOutputs accumule TOUTES les positions à travers TOUS les tours.
    // Chaque debater voit ses pairs du tour précédent au tour suivant.
    const priorOutputs: AgentPriorOutput[] = [...(ctx.priorOutputs ?? [])];

    for (let round = 1; round <= rounds; round++) {
      // À chaque tour, on lance les débatteurs EN PARALLÈLE — ils ne se
      // voient pas du tour en cours, ils voient seulement les tours
      // précédents via priorOutputs.
      // allSettled au lieu de all : un débatteur qui échoue ne tue pas la
      // pipeline. Le tour continue avec les survivants et le synthétiseur
      // verra moins de positions, mais le run aboutira.
      const snapshotForRound = [...priorOutputs];
      const settled = await Promise.allSettled(
        debaters.map(async (def, position) => {
          const startedAt = Date.now();
          await this.emit(args, writer, {
            type: "agent_start",
            pipelineRunId,
            agentId: def.id,
            role: def.role,
            label: def.label,
            position,
            round,
          });
          const agent = factory(def);
          const text = await withRetry(
            async () => {
              const result = await agent.run({
                ...ctx,
                pipelineRunId,
                priorOutputs: snapshotForRound,
                systemPromptExtras: this.councilTurnInstructions(
                  ctx.systemPromptExtras,
                  round,
                  rounds
                ),
              });
              return collectText(result);
            },
            {
              onRetry: async (attempt, delayMs) => {
                writer.write({
                  type: "data-agent-retry",
                  data: {
                    pipelineRunId,
                    agentId: def.id,
                    role: def.role,
                    label: def.label,
                    attempt,
                    delayMs,
                    round,
                  },
                });
              },
            }
          );
          writer.write({
            type: "data-agent-output",
            data: {
              pipelineRunId,
              agentId: def.id,
              role: def.role,
              label: def.label,
              output: text.value,
              round,
            },
          });
          await this.emit(args, writer, {
            type: "agent_finish",
            pipelineRunId,
            agentId: def.id,
            role: def.role,
            label: def.label,
            latencyMs: Date.now() - startedAt,
            inputTokens: text.inputTokens,
            outputTokens: text.outputTokens,
            preview: preview(text.value),
            round,
            modelId: def.modelOverride ?? null,
          });
          return {
            agentId: def.id,
            role: def.role,
            label: def.label,
            output: text.value,
            round,
          };
        })
      );

      // Sépare succès / échecs. Les échecs émettent agent_error mais ne
      // tuent pas le run — on continue avec les survivants.
      for (let i = 0; i < settled.length; i++) {
        const outcome = settled[i];
        if (outcome.status === "fulfilled") {
          priorOutputs.push(outcome.value);
        } else {
          await this.emitError(
            args,
            writer,
            debaters[i],
            pipelineRunId,
            outcome.reason,
            round
          );
        }
      }

      // Si TOUS les débatteurs ont échoué sur ce tour, on s'arrête : pas
      // de matière pour le synthétiseur, autant échouer franc.
      const successCount = settled.filter(
        (s) => s.status === "fulfilled"
      ).length;
      if (successCount === 0) {
        throw new Error(
          `Tous les débatteurs ont échoué au tour ${round} — pipeline annulée.`
        );
      }
    }

    // Synthétiseur final — voit toute la délibération.
    const startedAt = Date.now();
    await this.emit(args, writer, {
      type: "agent_start",
      pipelineRunId,
      agentId: synthesizer.id,
      role: synthesizer.role,
      label: synthesizer.label,
      position: agents.length - 1,
    });

    try {
      const agent = factory(synthesizer);
      const result = await agent.run({
        ...ctx,
        pipelineRunId,
        priorOutputs,
        systemPromptExtras: this.councilSynthesisInstructions(
          ctx.systemPromptExtras,
          rounds,
          debaters.length
        ),
      });
      await this.streamFinal({
        args,
        def: synthesizer,
        pipelineRunId,
        result,
        startedAt,
      });
    } catch (err) {
      await this.emitError(args, writer, synthesizer, pipelineRunId, err);
      throw err;
    }
  }

  private councilTurnInstructions(
    base: string | undefined,
    round: number,
    totalRounds: number
  ): string {
    const tourMsg =
      round === 1
        ? "C'est le PREMIER TOUR du conseil. Donne ta position initiale sur la question, argumentée et sourcée. Tu n'as pas encore vu les positions des autres membres."
        : `C'est le TOUR ${round} sur ${totalRounds} du conseil. Tu peux voir les positions des autres membres du tour précédent dans le contexte. RÉAGIS-Y : confirme, nuance, contredis, complète. Cite explicitement les positions des autres quand tu les commentes (« Membre X soutient que… or je pense que… »). Reste précis et sourcé.`;
    return base ? `${base}\n\n${tourMsg}` : tourMsg;
  }

  private councilSynthesisInstructions(
    base: string | undefined,
    rounds: number,
    debaterCount: number
  ): string {
    const msg = `Le conseil de ${debaterCount} membres a délibéré sur ${rounds} tour(s). Lis attentivement TOUTES les positions exprimées (incluant les contradictions et révisions au fil des tours). En tant que synthétiseur, ton rôle est de produire la décision finale qui sera servie à l'utilisateur :\n\n1. Identifie les points de CONSENSUS clairs et expose-les en premier.\n2. Identifie les points de DÉSACCORD significatifs et explique-les honnêtement (« Sur ce point, deux écoles s'affrontent… »).\n3. Tranche quand tu peux : prends position en t'appuyant sur l'argumentation la plus solide.\n4. Quand tu ne peux pas trancher, dis-le et précise quelles informations manquent.\n\nNe recopie pas les positions verbatim — synthétise.`;
    return base ? `${base}\n\n${msg}` : msg;
  }

  // ─── PARALLEL ──────────────────────────────────────────────────────────

  private async runParallel(args: OrchestratorRunArgs): Promise<void> {
    const { ctx, writer } = args;
    const factory = args.agentFactory ?? defaultAgentFactory;
    const pipelineRunId = ctx.pipelineRunId ?? nanoid();
    const agents = this.pipeline.agents;
    const synthesizer = agents[agents.length - 1];
    const workers = agents.slice(0, -1);

    if (workers.length === 0) return this.runSequential(args);

    const priorOutputs: AgentPriorOutput[] = [...(ctx.priorOutputs ?? [])];

    const settled = await Promise.allSettled(
      workers.map(async (def, position) => {
        const startedAt = Date.now();
        await this.emit(args, writer, {
          type: "agent_start",
          pipelineRunId,
          agentId: def.id,
          role: def.role,
          label: def.label,
          position,
        });
        const agent = factory(def);
        const text = await withRetry(
          async () => {
            const result = await agent.run({
              ...ctx,
              pipelineRunId,
              priorOutputs: [...priorOutputs],
            });
            return collectText(result);
          },
          {
            onRetry: async (attempt, delayMs) => {
              writer.write({
                type: "data-agent-retry",
                data: {
                  pipelineRunId,
                  agentId: def.id,
                  role: def.role,
                  label: def.label,
                  attempt,
                  delayMs,
                },
              });
            },
          }
        );
        writer.write({
          type: "data-agent-output",
          data: {
            pipelineRunId,
            agentId: def.id,
            role: def.role,
            label: def.label,
            output: text.value,
          },
        });
        await this.emit(args, writer, {
          type: "agent_finish",
          pipelineRunId,
          agentId: def.id,
          role: def.role,
          label: def.label,
          latencyMs: Date.now() - startedAt,
          inputTokens: text.inputTokens,
          outputTokens: text.outputTokens,
          preview: preview(text.value),
          modelId: def.modelOverride ?? null,
        });
        return {
          agentId: def.id,
          role: def.role,
          label: def.label,
          output: text.value,
        };
      })
    );

    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i];
      if (outcome.status === "fulfilled") {
        priorOutputs.push(outcome.value);
      } else {
        await this.emitError(args, writer, workers[i], pipelineRunId, outcome.reason);
      }
    }

    const successCount = settled.filter((s) => s.status === "fulfilled").length;
    if (successCount === 0) {
      throw new Error(
        "Tous les agents parallèles ont échoué — pipeline annulée."
      );
    }

    const startedAt = Date.now();
    await this.emit(args, writer, {
      type: "agent_start",
      pipelineRunId,
      agentId: synthesizer.id,
      role: synthesizer.role,
      label: synthesizer.label,
      position: agents.length - 1,
    });

    try {
      const agent = factory(synthesizer);
      const result = await agent.run({
        ...ctx,
        pipelineRunId,
        priorOutputs,
      });
      await this.streamFinal({
        args,
        def: synthesizer,
        pipelineRunId,
        result,
        startedAt,
      });
    } catch (err) {
      await this.emitError(args, writer, synthesizer, pipelineRunId, err);
      throw err;
    }
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────

  private async consumeIntermediate(opts: {
    args: OrchestratorRunArgs;
    def: AgentDefinition;
    pipelineRunId: string;
    result: AgentRunResult;
    priorOutputs: AgentPriorOutput[];
    startedAt: number;
  }): Promise<void> {
    const { args, def, pipelineRunId, result, priorOutputs, startedAt } = opts;
    const text = await collectText(result);
    priorOutputs.push({
      agentId: def.id,
      role: def.role,
      label: def.label,
      output: text.value,
    });
    // Émet le texte complet de cet agent intermédiaire dans un canal
    // distinct (data-agent-output) que le client utilise pour la theatre
    // view. Distinct de agent_finish dont le preview reste tronqué.
    args.writer.write({
      type: "data-agent-output",
      data: {
        pipelineRunId,
        agentId: def.id,
        role: def.role,
        label: def.label,
        output: text.value,
      },
    });
    await this.emit(args, args.writer, {
      type: "agent_finish",
      pipelineRunId,
      agentId: def.id,
      role: def.role,
      label: def.label,
      latencyMs: Date.now() - startedAt,
      inputTokens: text.inputTokens,
      outputTokens: text.outputTokens,
      preview: preview(text.value),
      modelId: def.modelOverride ?? null,
    });
  }

  private async streamFinal(opts: {
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
        modelId: def.modelOverride ?? null,
      });
    } else {
      args.writer.write({
        type: "data-final-text",
        data: { text: result.text },
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
        modelId: def.modelOverride ?? null,
      });
    }
  }

  private async emitError(
    args: OrchestratorRunArgs,
    writer: OrchestratorWriter,
    def: AgentDefinition,
    pipelineRunId: string,
    err: unknown,
    round?: number
  ): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    await this.emit(args, writer, {
      type: "agent_error",
      pipelineRunId,
      agentId: def.id,
      role: def.role,
      label: def.label,
      error: message,
      round,
      modelId: def.modelOverride ?? null,
    });
  }

  private async emit(
    args: OrchestratorRunArgs,
    writer: OrchestratorWriter,
    event: OrchestratorEvent
  ): Promise<void> {
    writer.write({
      type: "data-agent-event",
      data: event,
    });
    if (args.onEvent) {
      await args.onEvent(event);
    }
  }
}

/**
 * Collecte la sortie texte d'un AgentRunResult, qu'il s'agisse d'un stream
 * ou d'un texte déjà résolu. Consomme explicitement le stream (crucial en
 * AI SDK v6 pull-based) pour garantir que .text/.usage résolvent.
 */
async function collectText(result: AgentRunResult): Promise<{
  value: string;
  inputTokens?: number;
  outputTokens?: number;
}> {
  if (result.kind === "stream") {
    await result.stream.consumeStream();
    const value = await result.stream.text;
    const usage = await result.stream.usage;
    return {
      value,
      inputTokens: usage?.inputTokens ?? undefined,
      outputTokens: usage?.outputTokens ?? undefined,
    };
  }
  return {
    value: result.text,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}
