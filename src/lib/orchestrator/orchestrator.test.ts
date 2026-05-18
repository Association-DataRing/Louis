import { describe, expect, it, vi } from "vitest";
import { Orchestrator } from "./orchestrator";
import type {
  Agent,
  AgentContext,
  AgentDefinition,
  AgentRunResult,
  OrchestratorEvent,
  OrchestratorWriter,
  PipelineConfig,
} from "./index";

/**
 * Agent factice qui retourne `{ kind: "text" }` — pratique pour tester la
 * tuyauterie de l'orchestrateur sans mocker AI SDK. `observeContext` permet
 * de vérifier que le contexte passé (notamment priorOutputs) est correct.
 */
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
    return {
      kind: "text",
      text: this.output,
      inputTokens: 10,
      outputTokens: 20,
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
  return {
    slug: "test",
    name: "Test pipeline",
    agents,
  };
}

function makeWriter(): {
  writer: OrchestratorWriter;
  parts: unknown[];
  merges: unknown[];
} {
  const parts: unknown[] = [];
  const merges: unknown[] = [];
  return {
    parts,
    merges,
    writer: {
      write: (part) => parts.push(part),
      merge: (s) => merges.push(s),
    },
  };
}

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    userId: "u-1",
    conversationId: "c-1",
    messages: [],
    ...overrides,
  };
}

describe("Orchestrator: événements", () => {
  it("émet agent_start + agent_finish pour chaque agent d'une pipeline", async () => {
    const pipeline = makePipeline([
      makeAgentDef("a1", "research", "Recherche"),
      makeAgentDef("a2", "default-chat", "Synthèse"),
    ]);

    const orchestrator = new Orchestrator(pipeline);
    const { writer, parts } = makeWriter();
    const events: OrchestratorEvent[] = [];

    await orchestrator.run({
      ctx: makeCtx(),
      writer,
      onEvent: (e) => {
        events.push(e);
      },
      agentFactory: (def) => new FakeAgent(def, `output-${def.id}`),
    });

    expect(events.map((e) => e.type)).toEqual([
      "agent_start",
      "agent_finish",
      "agent_start",
      "agent_finish",
    ]);
    expect(events[0]).toMatchObject({ agentId: "a1", role: "research" });
    expect(events[2]).toMatchObject({ agentId: "a2", role: "default-chat" });

    // Les events doivent aussi transiter en data-agent-event sur le writer
    // (pour que l'UI puisse les afficher en live).
    const dataParts = parts.filter(
      (p): p is { type: string } =>
        !!p && typeof p === "object" && "type" in p
    );
    expect(dataParts.filter((p) => p.type === "data-agent-event")).toHaveLength(
      4
    );
  });

  it("émet agent_error et propage l'exception", async () => {
    const pipeline = makePipeline([
      makeAgentDef("ok"),
      makeAgentDef("ko"),
    ]);
    const orchestrator = new Orchestrator(pipeline);
    const { writer } = makeWriter();
    const events: OrchestratorEvent[] = [];

    await expect(
      orchestrator.run({
        ctx: makeCtx(),
        writer,
        onEvent: (e) => {
          events.push(e);
        },
        agentFactory: (def) =>
          new FakeAgent(def, "x", undefined, def.id === "ko"),
      })
    ).rejects.toThrow("agent failed intentionally");

    const types = events.map((e) => e.type);
    expect(types).toContain("agent_error");
    // Le 1er agent a bien fini avant que le 2e échoue.
    expect(types.indexOf("agent_finish")).toBeLessThan(
      types.indexOf("agent_error")
    );
  });
});

describe("Orchestrator: priorOutputs", () => {
  it("propage la sortie de chaque agent intermédiaire au suivant", async () => {
    const pipeline = makePipeline([
      makeAgentDef("rech", "research", "Recherche"),
      makeAgentDef("cit", "citator", "Citateur"),
      makeAgentDef("maestro", "orchestrator", "Maestro"),
    ]);
    const orchestrator = new Orchestrator(pipeline);
    const { writer } = makeWriter();

    const observed = new Map<string, AgentContext>();

    await orchestrator.run({
      ctx: makeCtx(),
      writer,
      agentFactory: (def) =>
        new FakeAgent(
          def,
          `out-${def.id}`,
          (ctx) => observed.set(def.id, structuredClone(ctx))
        ),
    });

    // Le 1er agent ne reçoit aucun priorOutput.
    expect(observed.get("rech")?.priorOutputs ?? []).toHaveLength(0);

    // Le 2e reçoit la sortie du 1er.
    expect(observed.get("cit")?.priorOutputs).toEqual([
      expect.objectContaining({
        agentId: "rech",
        role: "research",
        output: "out-rech",
      }),
    ]);

    // Le 3e (terminal) reçoit les sorties des 2 précédents.
    expect(observed.get("maestro")?.priorOutputs).toHaveLength(2);
    expect(observed.get("maestro")?.priorOutputs?.[0].agentId).toBe("rech");
    expect(observed.get("maestro")?.priorOutputs?.[1].agentId).toBe("cit");
  });

  it("préserve les priorOutputs initiaux fournis par le caller", async () => {
    const pipeline = makePipeline([makeAgentDef("only")]);
    const orchestrator = new Orchestrator(pipeline);
    const { writer } = makeWriter();
    let captured: AgentContext | null = null;

    await orchestrator.run({
      ctx: makeCtx({
        priorOutputs: [
          {
            agentId: "external",
            role: "research",
            label: "External",
            output: "external-out",
          },
        ],
      }),
      writer,
      agentFactory: (def) =>
        new FakeAgent(def, "x", (ctx) => {
          captured = structuredClone(ctx);
        }),
    });

    expect(captured).not.toBeNull();
    expect(captured!.priorOutputs?.[0].agentId).toBe("external");
  });
});

describe("Orchestrator: pipelineRunId", () => {
  it("génère un pipelineRunId stable et le partage entre tous les events", async () => {
    const pipeline = makePipeline([
      makeAgentDef("a"),
      makeAgentDef("b"),
    ]);
    const orchestrator = new Orchestrator(pipeline);
    const { writer } = makeWriter();
    const events: OrchestratorEvent[] = [];

    await orchestrator.run({
      ctx: makeCtx(),
      writer,
      onEvent: (e) => {
        events.push(e);
      },
      agentFactory: (def) => new FakeAgent(def, def.id),
    });

    const ids = new Set(events.map((e) => e.pipelineRunId));
    expect(ids.size).toBe(1);
    const id = [...ids][0];
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("respecte le pipelineRunId fourni dans le contexte", async () => {
    const pipeline = makePipeline([makeAgentDef("a")]);
    const orchestrator = new Orchestrator(pipeline);
    const { writer } = makeWriter();
    const events: OrchestratorEvent[] = [];

    await orchestrator.run({
      ctx: makeCtx({ pipelineRunId: "custom-run-id" }),
      writer,
      onEvent: (e) => {
        events.push(e);
      },
      agentFactory: (def) => new FakeAgent(def, "x"),
    });

    expect(events.every((e) => e.pipelineRunId === "custom-run-id")).toBe(true);
  });
});

describe("Orchestrator: garde-fous", () => {
  it("refuse une pipeline sans agents", () => {
    expect(() => new Orchestrator(makePipeline([]))).toThrow(/sans agents/);
  });

  it("appelle onEvent avant que l'agent suivant ne démarre", async () => {
    const pipeline = makePipeline([
      makeAgentDef("a1"),
      makeAgentDef("a2"),
    ]);
    const orchestrator = new Orchestrator(pipeline);
    const { writer } = makeWriter();
    const order: string[] = [];

    await orchestrator.run({
      ctx: makeCtx(),
      writer,
      onEvent: (e) => {
        order.push(`event:${e.type}:${e.agentId}`);
      },
      agentFactory: (def) =>
        new FakeAgent(def, "x", () => {
          order.push(`run:${def.id}`);
        }),
    });

    expect(order).toEqual([
      "event:agent_start:a1",
      "run:a1",
      "event:agent_finish:a1",
      "event:agent_start:a2",
      "run:a2",
      "event:agent_finish:a2",
    ]);
  });
});

describe("Orchestrator: latence + tokens", () => {
  it("rapporte une latence positive et les tokens consommés", async () => {
    const pipeline = makePipeline([makeAgentDef("a")]);
    const orchestrator = new Orchestrator(pipeline);
    const { writer } = makeWriter();
    const events: OrchestratorEvent[] = [];

    await orchestrator.run({
      ctx: makeCtx(),
      writer,
      onEvent: (e) => {
        events.push(e);
      },
      agentFactory: (def) => new FakeAgent(def, "x"),
    });

    const finish = events.find((e) => e.type === "agent_finish");
    expect(finish).toBeDefined();
    if (finish?.type === "agent_finish") {
      expect(finish.latencyMs).toBeGreaterThanOrEqual(0);
      expect(finish.inputTokens).toBe(10);
      expect(finish.outputTokens).toBe(20);
    }
  });
});

describe("Orchestrator: factory par défaut", () => {
  it("utilise un FakeAgent à la place sans toucher au registry réel", async () => {
    const pipeline = makePipeline([makeAgentDef("a", "research")]);
    const orchestrator = new Orchestrator(pipeline);
    const { writer } = makeWriter();
    const customFactory = vi.fn(
      (def: AgentDefinition) => new FakeAgent(def, "ok")
    );

    await orchestrator.run({
      ctx: makeCtx(),
      writer,
      agentFactory: customFactory,
    });

    expect(customFactory).toHaveBeenCalledTimes(1);
    expect(customFactory).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a", role: "research" })
    );
  });
});
