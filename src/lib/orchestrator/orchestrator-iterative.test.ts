import { describe, it, expect } from "vitest";
import { Orchestrator, type OrchestratorWriter } from "./orchestrator";
import type {
  Agent,
  AgentContext,
  AgentDefinition,
  PipelineConfig,
} from "./types";

const def = (id: string, label: string): AgentDefinition => ({
  id,
  role: "research",
  label,
  providerKeyId: "00000000-0000-0000-0000-000000000000",
});

const ctx: AgentContext = {
  userId: "u",
  conversationId: "c",
  messages: [],
};

function noopWriter(): OrchestratorWriter {
  return { write: () => {}, merge: () => {} };
}

/** Factory mock : compte les exécutions et capture le systemPromptExtras vu. */
function mockFactory(
  calls: Record<string, number>,
  extras: Record<string, string[]>
) {
  return (d: AgentDefinition): Agent => ({
    definition: d,
    async run(c: AgentContext) {
      calls[d.id] = (calls[d.id] ?? 0) + 1;
      (extras[d.id] ??= []).push(c.systemPromptExtras ?? "");
      return { kind: "text", text: `${d.label} output` };
    },
  });
}

describe("Orchestrator mode iterative", () => {
  it("chercheur + synthétiseur : chercheur tourne `rounds` fois, synthèse 1 fois", async () => {
    const pipeline: PipelineConfig = {
      slug: "iter",
      name: "Iter",
      mode: "iterative",
      rounds: 3,
      agents: [def("r", "Chercheur"), def("s", "Synthèse")],
    };
    const calls: Record<string, number> = {};
    const extras: Record<string, string[]> = {};
    await new Orchestrator(pipeline).run({
      ctx,
      writer: noopWriter(),
      agentFactory: mockFactory(calls, extras),
    });
    expect(calls.r).toBe(3);
    expect(calls.s).toBe(1);
  });

  it("instructions round-aware : tour 1 ≠ tours suivants", async () => {
    const pipeline: PipelineConfig = {
      slug: "iter",
      name: "Iter",
      mode: "iterative",
      rounds: 2,
      agents: [def("r", "Chercheur"), def("s", "Synthèse")],
    };
    const calls: Record<string, number> = {};
    const extras: Record<string, string[]> = {};
    await new Orchestrator(pipeline).run({
      ctx,
      writer: noopWriter(),
      agentFactory: mockFactory(calls, extras),
    });
    expect(extras.r[0]).toContain("PREMIER TOUR");
    expect(extras.r[1]).toContain("TOUR 2/2");
    expect(extras.s[0]).toContain("NOTE DE RECHERCHE");
  });

  it("mono-agent : tourne `rounds` fois et le dernier tour stream", async () => {
    const pipeline: PipelineConfig = {
      slug: "iter",
      name: "Iter",
      mode: "iterative",
      rounds: 2,
      agents: [def("r", "Chercheur")],
    };
    const calls: Record<string, number> = {};
    const extras: Record<string, string[]> = {};
    await new Orchestrator(pipeline).run({
      ctx,
      writer: noopWriter(),
      agentFactory: mockFactory(calls, extras),
    });
    expect(calls.r).toBe(2);
  });

  it("borne le nombre de tours à 4", async () => {
    const pipeline: PipelineConfig = {
      slug: "iter",
      name: "Iter",
      mode: "iterative",
      rounds: 99,
      agents: [def("r", "Chercheur"), def("s", "Synthèse")],
    };
    const calls: Record<string, number> = {};
    const extras: Record<string, string[]> = {};
    await new Orchestrator(pipeline).run({
      ctx,
      writer: noopWriter(),
      agentFactory: mockFactory(calls, extras),
    });
    expect(calls.r).toBe(4);
  });
});
