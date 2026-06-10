import { nanoid } from "nanoid";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { DefaultAgent, resolveAgentConstructor } from "./agents";
import { withRetry } from "./retry";
import {
  DEFAULT_ITERATIVE_ROUNDS,
  MAX_COUNCIL_ROUNDS,
  MAX_ITERATIVE_ROUNDS,
} from "./types";
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
    if (mode === "iterative") return this.runIterative(args);
    if (mode === "maestro") return this.runMaestro(args);
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
    const rounds = Math.max(
      1,
      Math.min(this.pipeline.rounds ?? 1, MAX_COUNCIL_ROUNDS)
    );
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
      // H10 : fallback — on sert les positions brutes plutôt qu'une erreur
      // vide. Pas de re-throw : le run se termine proprement et le texte de
      // repli est persisté comme une réponse normale.
      this.streamStaticText(writer, this.buildSynthesisFallback(priorOutputs));
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

  // ─── ITERATIVE ─────────────────────────────────────────────────────────

  /**
   * Approfondissement multi-tours : le 1er agent (chercheur) reprend SES
   * PROPRES notes à chaque tour pour creuser les lacunes qu'il a lui-même
   * identifiées, puis le dernier agent produit une note de recherche
   * synthétique. Différent du council (un seul chercheur, profondeur vs débat).
   * Reste souverain : les sources sont celles des outils de l'agent
   * (Légifrance/Pappers/documents), jamais le web.
   */
  private async runIterative(args: OrchestratorRunArgs): Promise<void> {
    const { ctx, writer } = args;
    const factory = args.agentFactory ?? defaultAgentFactory;
    const pipelineRunId = ctx.pipelineRunId ?? nanoid();
    const rounds = Math.max(
      1,
      Math.min(this.pipeline.rounds ?? DEFAULT_ITERATIVE_ROUNDS, MAX_ITERATIVE_ROUNDS)
    );
    const agents = this.pipeline.agents;
    const researcher = agents[0];
    const synthesizer = agents[agents.length - 1];
    const hasSynth = agents.length > 1;
    const priorOutputs: AgentPriorOutput[] = [...(ctx.priorOutputs ?? [])];

    for (let round = 1; round <= rounds; round++) {
      // Sans synthétiseur distinct, le DERNIER tour stream directement la réponse.
      const streamLast = !hasSynth && round === rounds;
      const startedAt = Date.now();
      await this.emit(args, writer, {
        type: "agent_start",
        pipelineRunId,
        agentId: researcher.id,
        role: researcher.role,
        label: researcher.label,
        position: 0,
        round,
      });
      try {
        const agent = factory(researcher);
        const runCtx: AgentContext = {
          ...ctx,
          pipelineRunId,
          priorOutputs: [...priorOutputs],
          systemPromptExtras: this.iterativeRoundInstructions(
            ctx.systemPromptExtras,
            round,
            rounds
          ),
        };
        if (streamLast) {
          const result = await agent.run(runCtx);
          await this.streamFinal({
            args,
            def: researcher,
            pipelineRunId,
            result,
            startedAt,
          });
        } else {
          const text = await withRetry(
            async () => collectText(await agent.run(runCtx)),
            {
              onRetry: async (attempt, delayMs) => {
                writer.write({
                  type: "data-agent-retry",
                  data: {
                    pipelineRunId,
                    agentId: researcher.id,
                    role: researcher.role,
                    label: researcher.label,
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
              agentId: researcher.id,
              role: researcher.role,
              label: researcher.label,
              output: text.value,
              round,
            },
          });
          await this.emit(args, writer, {
            type: "agent_finish",
            pipelineRunId,
            agentId: researcher.id,
            role: researcher.role,
            label: researcher.label,
            latencyMs: Date.now() - startedAt,
            inputTokens: text.inputTokens,
            outputTokens: text.outputTokens,
            preview: preview(text.value),
            round,
            modelId: researcher.modelOverride ?? null,
          });
          priorOutputs.push({
            agentId: researcher.id,
            role: researcher.role,
            label: researcher.label,
            output: text.value,
            round,
          });
        }
      } catch (err) {
        await this.emitError(args, writer, researcher, pipelineRunId, err, round);
        throw err;
      }
    }

    if (!hasSynth) return; // mono-agent : le dernier tour a déjà streamé

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
        systemPromptExtras: this.iterativeSynthesisInstructions(
          ctx.systemPromptExtras,
          rounds
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
      this.streamStaticText(writer, this.buildSynthesisFallback(priorOutputs));
    }
  }

  private iterativeRoundInstructions(
    base: string | undefined,
    round: number,
    totalRounds: number
  ): string {
    const msg =
      round === 1
        ? "PREMIER TOUR de recherche itérative. Établis le cadre : identifie le régime applicable et les premières sources via tes outils (Légifrance, Pappers, recherche documentaire). Termine en listant EXPLICITEMENT les LACUNES qui restent à creuser."
        : `TOUR ${round}/${totalRounds}. Tes notes des tours précédents te sont fournies comme données de référence. CREUSE les lacunes que tu avais identifiées : nouvelles sources, jurisprudence, divergences doctrinales. N'redonne pas ce qui est déjà couvert — apporte du nouveau, puis liste les lacunes restantes.`;
    return base ? `${base}\n\n${msg}` : msg;
  }

  private iterativeSynthesisInstructions(
    base: string | undefined,
    rounds: number
  ): string {
    const msg = `La recherche a été menée sur ${rounds} tour(s) d'approfondissement (notes fournies en référence). Produis une NOTE DE RECHERCHE structurée pour l'utilisateur : régime applicable, sources citées, points établis, points incertains, conclusion. Ne recopie pas les notes verbatim — synthétise.`;
    return base ? `${base}\n\n${msg}` : msg;
  }

  // ─── MAESTRO ───────────────────────────────────────────────────────────

  /**
   * Routage dynamique : le terminal (Maestro) reçoit chaque agent de
   * l'équipe comme OUTIL appelable — c'est LUI qui décide qui consulter,
   * dans quel ordre, avec quelle consigne, et il peut re-déléguer pour
   * creuser ou vérifier. À la différence des autres modes, la topologie
   * du run n'est pas figée à l'avance : elle émerge des décisions du
   * Maestro pendant son streaming.
   *
   * Chaque délégation émet les mêmes événements que les agents
   * intermédiaires classiques (agent_start/finish/error + data-agent-output)
   * — le théâtre et l'audit trail fonctionnent sans changement. `round`
   * numérote les appels successifs à un même agent.
   */
  private async runMaestro(args: OrchestratorRunArgs): Promise<void> {
    const { ctx, writer } = args;
    const factory = args.agentFactory ?? defaultAgentFactory;
    const pipelineRunId = ctx.pipelineRunId ?? nanoid();
    const agents = this.pipeline.agents;
    const maestro = agents[agents.length - 1];
    const team = agents.slice(0, -1);

    // Sans équipe à diriger, on retombe sur du séquentiel (mono-agent).
    if (team.length === 0) return this.runSequential(args);

    const priorOutputs: AgentPriorOutput[] = [...(ctx.priorOutputs ?? [])];
    const callCounts = new Map<string, number>();

    const extraTools: ToolSet = {};
    const toolNames: Array<{ name: string; def: AgentDefinition }> = [];
    team.forEach((def, position) => {
      const name = agentToolName(def.label, position);
      toolNames.push({ name, def });
      extraTools[name] = tool({
        description: `Délègue une tâche à l'agent « ${def.label} » (rôle : ${def.role}). L'agent voit la conversation complète et les sorties déjà produites par l'équipe ; donne-lui une consigne précise et autonome.`,
        inputSchema: z.object({
          instruction: z
            .string()
            .min(1)
            .describe(
              "Consigne précise pour cet agent : quoi chercher/produire/vérifier, sous quel angle, avec quel livrable attendu."
            ),
        }),
        execute: async ({ instruction }) => {
          const round = (callCounts.get(def.id) ?? 0) + 1;
          callCounts.set(def.id, round);
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
          try {
            const agent = factory(def);
            const text = await withRetry(
              async () =>
                collectText(
                  await agent.run({
                    ...ctx,
                    pipelineRunId,
                    priorOutputs: [...priorOutputs],
                    systemPromptExtras: this.maestroDelegationInstructions(
                      ctx.systemPromptExtras,
                      instruction
                    ),
                  })
                ),
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
            priorOutputs.push({
              agentId: def.id,
              role: def.role,
              label: def.label,
              output: text.value,
              round,
            });
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
            return text.value;
          } catch (err) {
            // Un membre qui échoue ne tue pas le run : le Maestro reçoit
            // l'échec comme résultat d'outil et peut adapter sa stratégie.
            await this.emitError(args, writer, def, pipelineRunId, err, round);
            const message = err instanceof Error ? err.message : String(err);
            return `⚠️ L'agent « ${def.label} » a échoué (${message}). Poursuis sans lui, reformule ta consigne, ou signale la limite dans ta réponse.`;
          }
        },
      });
    });

    const startedAt = Date.now();
    await this.emit(args, writer, {
      type: "agent_start",
      pipelineRunId,
      agentId: maestro.id,
      role: maestro.role,
      label: maestro.label,
      position: agents.length - 1,
    });

    try {
      const agent = factory(maestro);
      const result = await agent.run({
        ...ctx,
        pipelineRunId,
        priorOutputs,
        extraTools,
        // Routage = délégations + outils éventuels + réponse finale : le
        // plafond du synthétiseur (5) brides le Maestro, on lui laisse de
        // la marge sans pour autant autoriser des boucles infinies.
        maxStepsOverride: 8,
        systemPromptExtras: this.maestroRoutingInstructions(
          ctx.systemPromptExtras,
          toolNames
        ),
      });
      await this.streamFinal({
        args,
        def: maestro,
        pipelineRunId,
        result,
        startedAt,
      });
    } catch (err) {
      await this.emitError(args, writer, maestro, pipelineRunId, err);
      // Même filet de sécurité qu'en council/parallel : si des délégations
      // ont abouti, on sert leurs sorties brutes plutôt qu'une erreur vide.
      this.streamStaticText(writer, this.buildSynthesisFallback(priorOutputs));
    }
  }

  private maestroRoutingInstructions(
    base: string | undefined,
    team: Array<{ name: string; def: AgentDefinition }>
  ): string {
    const roster = team
      .map((t) => `- \`${t.name}\` — ${t.def.label} (rôle : ${t.def.role})`)
      .join("\n");
    const msg = `Tu es le MAESTRO ROUTEUR de cette équipe. Tu disposes d'agents spécialisés appelables comme outils :\n\n${roster}\n\nDiscipline de routage :\n1. Analyse la demande et décide quels agents consulter — tous ne sont pas toujours utiles.\n2. Délègue avec une consigne PRÉCISE et autonome (l'agent voit la conversation, pas tes intentions).\n3. Tu peux rappeler un agent pour creuser ou vérifier, et consulter plusieurs agents avant de conclure.\n4. Si la demande est simple, réponds directement sans déléguer — ne consomme pas l'équipe pour rien.\n5. Une fois ta matière réunie, produis TOI-MÊME la réponse finale à l'utilisateur en t'appuyant sur les sorties de l'équipe : synthétique, sourcée, fidèle à leur travail.`;
    return base ? `${base}\n\n${msg}` : msg;
  }

  private maestroDelegationInstructions(
    base: string | undefined,
    instruction: string
  ): string {
    const msg = `Tu interviens comme membre d'une équipe dirigée par un agent Maestro. Sa consigne pour cette intervention :\n\n« ${instruction} »\n\nConcentre-toi sur cette consigne. La conversation complète et les sorties déjà produites par l'équipe te sont fournies comme matériau de référence.`;
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
      // H10 : même fallback qu'en council — positions brutes des workers
      // plutôt qu'une erreur vide.
      this.streamStaticText(writer, this.buildSynthesisFallback(priorOutputs));
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
      // Agent terminal renvoyant du texte (non-stream) : on émet du VRAI texte
      // (text-start/delta/end), seule voie effectivement rendue ET persistée
      // par route.ts. Auparavant on écrivait data-final-text, consommé nulle
      // part → la réponse était silencieusement perdue.
      this.streamStaticText(args.writer, result.text);
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

  /**
   * H10 — quand le synthétiseur échoue, on ne renvoie pas une réponse vide à
   * l'utilisateur : on sert les positions brutes du conseil, précédées d'un
   * avertissement clair (non arbitrées, non vérifiées). On émet du vrai texte
   * (text-start/delta/end) — la seule voie effectivement rendue ET persistée
   * par `route.ts` (data-final-text n'est consommé nulle part).
   */
  private streamStaticText(writer: OrchestratorWriter, text: string): void {
    const id = nanoid();
    writer.write({ type: "text-start", id });
    writer.write({ type: "text-delta", id, delta: text });
    writer.write({ type: "text-end", id });
  }

  private buildSynthesisFallback(priorOutputs: AgentPriorOutput[]): string {
    const header =
      "> ⚠️ **Synthèse échouée** — le synthétiseur n'a pas pu produire de décision finale.\n>\n" +
      "> Voici les **positions brutes** exprimées par le conseil, **ni arbitrées ni vérifiées**. À relire et valider par un juriste avant tout usage.";
    if (priorOutputs.length === 0) {
      return `${header}\n\n_Aucune position n'a pu être recueillie._`;
    }
    const blocks = priorOutputs.map((p) => {
      const tour = typeof p.round === "number" ? ` · tour ${p.round}` : "";
      return `### ${p.label}${tour}\n\n${p.output.trim()}`;
    });
    return `${header}\n\n${blocks.join("\n\n---\n\n")}`;
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
 * Nom d'outil AI SDK pour un agent d'équipe en mode maestro. Contrainte du
 * SDK : `^[a-zA-Z0-9_-]+$` — on translittère le label (accents retirés) et
 * on préfixe par la position pour garantir l'unicité même à labels égaux.
 */
export function agentToolName(label: string, position: number): string {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `agent_${position + 1}_${slug || "membre"}`;
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
