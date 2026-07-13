import { describe, expect, it } from "vitest";
import {
  Orchestrator,
  agentToolName,
  type OrchestratorWriter,
} from "./orchestrator";
import type {
  Agent,
  AgentContext,
  AgentDefinition,
  AgentRunResult,
  OrchestratorEvent,
  PipelineConfig,
} from "./types";

/** Agent factice texte (cf. orchestrator.test.ts). */
class FakeAgent implements Agent {
  constructor(
    public readonly definition: AgentDefinition,
    private readonly output: string,
    private readonly observeContext?: (ctx: AgentContext) => void,
    private readonly shouldThrow?: boolean
  ) {}

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    this.observeContext?.(ctx);
    if (this.shouldThrow) throw new Error("agent failed intentionally");
    return { kind: "text", text: this.output, inputTokens: 10, outputTokens: 20 };
  }
}

/**
 * Maestro factice : exécute un « plan » de délégations via ctx.extraTools
 * (comme le ferait le LLM en appelant ses outils), puis répond avec les
 * résultats concaténés. Permet de tester la tuyauterie agent-as-tool sans
 * mocker AI SDK.
 */
class FakeMaestro implements Agent {
  public seenCtx: AgentContext | null = null;
  public toolResults: string[] = [];

  constructor(
    public readonly definition: AgentDefinition,
    private readonly plan: Array<{ tool: string; instruction: string }>,
    private readonly shouldThrow?: boolean
  ) {}

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    this.seenCtx = ctx;
    const tools = ctx.extraTools ?? {};
    for (const step of this.plan) {
      const t = tools[step.tool];
      if (!t?.execute) throw new Error(`outil manquant : ${step.tool}`);
      const out = await t.execute(
        { instruction: step.instruction },
        { toolCallId: "tc-test", messages: [] }
      );
      this.toolResults.push(String(out));
    }
    if (this.shouldThrow) throw new Error("maestro failed intentionally");
    return {
      kind: "text",
      text: `final: ${this.toolResults.join(" | ")}`,
      inputTokens: 5,
      outputTokens: 7,
    };
  }
}

function makeAgentDef(
  id: string,
  role: AgentDefinition["role"] = "default-chat",
  label = id
): AgentDefinition {
  return {
    id,
    role,
    label,
    providerKeyId: "00000000-0000-0000-0000-000000000000",
  };
}

function makePipeline(agents: AgentDefinition[]): PipelineConfig {
  return { slug: "test-maestro", name: "Test maestro", mode: "maestro", agents };
}

function makeWriter(): { writer: OrchestratorWriter; parts: unknown[] } {
  const parts: unknown[] = [];
  return {
    parts,
    writer: { write: (part) => parts.push(part), merge: () => {} },
  };
}

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return { userId: "u-1", conversationId: "c-1", messages: [], ...overrides };
}

describe("agentToolName", () => {
  it("translittère accents et caractères spéciaux, préfixe par la position", () => {
    expect(agentToolName("Recherche", 0)).toBe("agent_1_recherche");
    expect(agentToolName("Rédacteur d'actes", 2)).toBe("agent_3_redacteur_d_actes");
    expect(agentToolName("⚖️", 1)).toBe("agent_2_membre");
  });

  it("garantit l'unicité à labels identiques via la position", () => {
    expect(agentToolName("Expert", 0)).not.toBe(agentToolName("Expert", 1));
  });
});

describe("Orchestrator: mode maestro", () => {
  it("expose l'équipe comme outils au terminal et relaie leurs sorties", async () => {
    const research = makeAgentDef("a1", "research", "Recherche");
    const citator = makeAgentDef("a2", "citator", "Citateur");
    const maestroDef = makeAgentDef("a3", "orchestrator", "Maestro");

    const subContexts: AgentContext[] = [];
    const maestro = new FakeMaestro(maestroDef, [
      { tool: "agent_1_recherche", instruction: "Trouve les sources." },
      { tool: "agent_2_citateur", instruction: "Vérifie les citations." },
    ]);

    const orchestrator = new Orchestrator(
      makePipeline([research, citator, maestroDef])
    );
    const { writer, parts } = makeWriter();
    const events: OrchestratorEvent[] = [];

    await orchestrator.run({
      ctx: makeCtx(),
      writer,
      onEvent: (e) => {
        events.push(e);
      },
      agentFactory: (def) =>
        def.id === "a3"
          ? maestro
          : new FakeAgent(def, `out-${def.id}`, (ctx) => subContexts.push(ctx)),
    });

    // Le maestro reçoit les outils d'équipe + un plafond de steps élargi.
    expect(Object.keys(maestro.seenCtx?.extraTools ?? {})).toEqual([
      "agent_1_recherche",
      "agent_2_citateur",
    ]);
    expect(maestro.seenCtx?.maxStepsOverride).toBe(8);

    // Les résultats d'outils sont les sorties des agents délégués.
    expect(maestro.toolResults).toEqual(["out-a1", "out-a2"]);

    // Le maestro démarre AVANT ses délégations (c'est lui qui les décide),
    // chaque délégation émet start+finish, le maestro finit en dernier.
    expect(events.map((e) => `${e.type}:${e.agentId}`)).toEqual([
      "agent_start:a3",
      "agent_start:a1",
      "agent_finish:a1",
      "agent_start:a2",
      "agent_finish:a2",
      "agent_finish:a3",
    ]);

    // La consigne du maestro atteint le sous-agent (system prompt extras) et
    // le second sous-agent voit la sortie du premier (priorOutputs snapshot).
    expect(subContexts[0].systemPromptExtras).toContain("Trouve les sources.");
    expect(subContexts[1].priorOutputs?.map((p) => p.output)).toEqual([
      "out-a1",
    ]);

    // Theatre : chaque délégation publie sa sortie complète.
    const outputs = parts.filter(
      (p): p is { type: string; data: { output: string } } =>
        !!p && typeof p === "object" && (p as { type?: string }).type === "data-agent-output"
    );
    expect(outputs.map((o) => o.data.output)).toEqual(["out-a1", "out-a2"]);
  });

  it("numérote les rappels d'un même agent via round", async () => {
    const research = makeAgentDef("a1", "research", "Recherche");
    const maestroDef = makeAgentDef("a2", "orchestrator", "Maestro");
    const maestro = new FakeMaestro(maestroDef, [
      { tool: "agent_1_recherche", instruction: "Premier angle." },
      { tool: "agent_1_recherche", instruction: "Creuse la prescription." },
    ]);

    const events: OrchestratorEvent[] = [];
    await new Orchestrator(makePipeline([research, maestroDef])).run({
      ctx: makeCtx(),
      writer: makeWriter().writer,
      onEvent: (e) => {
        events.push(e);
      },
      agentFactory: (def) =>
        def.id === "a2" ? maestro : new FakeAgent(def, `out-${def.id}`),
    });

    const finishes = events.filter(
      (e) => e.type === "agent_finish" && e.agentId === "a1"
    );
    expect(finishes.map((e) => e.round)).toEqual([1, 2]);
  });

  it("transforme l'échec d'un membre en résultat d'outil sans tuer le run", async () => {
    const research = makeAgentDef("a1", "research", "Recherche");
    const maestroDef = makeAgentDef("a2", "orchestrator", "Maestro");
    const maestro = new FakeMaestro(maestroDef, [
      { tool: "agent_1_recherche", instruction: "Va échouer." },
    ]);

    const events: OrchestratorEvent[] = [];
    const { writer, parts } = makeWriter();
    await new Orchestrator(makePipeline([research, maestroDef])).run({
      ctx: makeCtx(),
      writer,
      onEvent: (e) => {
        events.push(e);
      },
      agentFactory: (def) =>
        def.id === "a2"
          ? maestro
          : new FakeAgent(def, "", undefined, /* shouldThrow */ true),
    });

    // L'échec est signalé à l'UI/audit…
    expect(events.some((e) => e.type === "agent_error" && e.agentId === "a1")).toBe(
      true
    );
    // …et le maestro reçoit un message d'échec exploitable comme résultat.
    expect(maestro.toolResults[0]).toContain("a échoué");
    // Le run aboutit : la réponse finale est streamée en texte.
    expect(
      parts.some(
        (p) =>
          !!p &&
          typeof p === "object" &&
          (p as { type?: string }).type === "text-delta"
      )
    ).toBe(true);
  });

  it("sert les délégations brutes si le maestro échoue après coup", async () => {
    const research = makeAgentDef("a1", "research", "Recherche");
    const maestroDef = makeAgentDef("a2", "orchestrator", "Maestro");
    const maestro = new FakeMaestro(
      maestroDef,
      [{ tool: "agent_1_recherche", instruction: "Cherche." }],
      /* shouldThrow */ true
    );

    const { writer, parts } = makeWriter();
    const events: OrchestratorEvent[] = [];
    await new Orchestrator(makePipeline([research, maestroDef])).run({
      ctx: makeCtx(),
      writer,
      onEvent: (e) => {
        events.push(e);
      },
      agentFactory: (def) =>
        def.id === "a2" ? maestro : new FakeAgent(def, "sortie-recherche"),
    });

    expect(events.some((e) => e.type === "agent_error" && e.agentId === "a2")).toBe(
      true
    );
    const deltas = parts
      .filter(
        (p): p is { type: string; delta: string } =>
          !!p &&
          typeof p === "object" &&
          (p as { type?: string }).type === "text-delta"
      )
      .map((p) => p.delta)
      .join("");
    expect(deltas).toContain("sortie-recherche");
    expect(deltas).toContain("Synthèse échouée");
  });

  it("retombe en séquentiel quand la pipeline maestro n'a qu'un agent", async () => {
    const solo = makeAgentDef("a1", "default-chat", "Solo");
    const events: OrchestratorEvent[] = [];
    const observed: AgentContext[] = [];
    await new Orchestrator(makePipeline([solo])).run({
      ctx: makeCtx(),
      writer: makeWriter().writer,
      onEvent: (e) => {
        events.push(e);
      },
      agentFactory: (def) =>
        new FakeAgent(def, "réponse", (ctx) => observed.push(ctx)),
    });

    expect(events.map((e) => e.type)).toEqual(["agent_start", "agent_finish"]);
    expect(observed[0].extraTools).toBeUndefined();
  });
});
