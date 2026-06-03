import { describe, expect, it } from "vitest";
import {
  AGENT_REGISTRY,
  CitatorAgent,
  DefaultAgent,
  DraftingAgent,
  LegifranceAgent,
  OrchestratorAgent,
  ResearchAgent,
  ReviewerAgent,
  resolveAgentConstructor,
} from "./index";
import { composeSystem, filterTools } from "./default";
import type { AgentContext, AgentDefinition } from "../types";

describe("Agent registry: résolution par rôle", () => {
  it("default-chat → DefaultAgent", () => {
    expect(resolveAgentConstructor("default-chat")).toBe(DefaultAgent);
  });

  it("research → ResearchAgent", () => {
    expect(resolveAgentConstructor("research")).toBe(ResearchAgent);
  });

  it("citator → CitatorAgent", () => {
    expect(resolveAgentConstructor("citator")).toBe(CitatorAgent);
  });

  it("reviewer → ReviewerAgent", () => {
    expect(resolveAgentConstructor("reviewer")).toBe(ReviewerAgent);
  });

  it("orchestrator → OrchestratorAgent", () => {
    expect(resolveAgentConstructor("orchestrator")).toBe(OrchestratorAgent);
  });

  it("drafting → DraftingAgent (P6 : rôle désormais implémenté)", () => {
    expect(resolveAgentConstructor("drafting")).toBe(DraftingAgent);
  });

  it("legifrance → LegifranceAgent (P6 : rôle désormais implémenté)", () => {
    expect(resolveAgentConstructor("legifrance")).toBe(LegifranceAgent);
  });

  it("AGENT_REGISTRY est cohérent avec les exports nommés", () => {
    expect(AGENT_REGISTRY["default-chat"]).toBe(DefaultAgent);
    expect(AGENT_REGISTRY.research).toBe(ResearchAgent);
    expect(AGENT_REGISTRY.citator).toBe(CitatorAgent);
    expect(AGENT_REGISTRY.reviewer).toBe(ReviewerAgent);
    expect(AGENT_REGISTRY.orchestrator).toBe(OrchestratorAgent);
    expect(AGENT_REGISTRY.drafting).toBe(DraftingAgent);
    expect(AGENT_REGISTRY.legifrance).toBe(LegifranceAgent);
  });
});

const baseDef: AgentDefinition = {
  id: "test",
  role: "default-chat",
  label: "Test",
  providerKeyId: "00000000-0000-0000-0000-000000000000",
};

const baseCtx: AgentContext = {
  userId: "u",
  conversationId: "c",
  messages: [],
};

describe("composeSystem", () => {
  it("retourne le prompt factory si rien de plus", () => {
    const out = composeSystem("FACTORY", baseDef, baseCtx);
    expect(out).toBe("FACTORY");
  });

  it("override du prompt si systemPrompt défini sur l'agent", () => {
    const out = composeSystem("FACTORY", { ...baseDef, systemPrompt: "OVERRIDE" }, baseCtx);
    expect(out).toBe("OVERRIDE");
  });

  it("concatène les extras du contexte", () => {
    const out = composeSystem("FACTORY", baseDef, {
      ...baseCtx,
      systemPromptExtras: "EXTRAS",
    });
    expect(out).toContain("FACTORY");
    expect(out).toContain("EXTRAS");
  });

  it("active la politique non-fiable quand priorOutputs présent, SANS y fuiter le contenu", () => {
    // Sécurité : les sorties d'agents précédents sont désormais traitées comme
    // des données non fiables (injectées côté messages), pas concaténées dans
    // le prompt système. composeSystem ne doit donc PAS contenir leur texte,
    // mais doit activer la politique de séparation instruction/donnée.
    const out = composeSystem("FACTORY", baseDef, {
      ...baseCtx,
      priorOutputs: [
        { agentId: "p1", role: "research", label: "Recherche", output: "DONNÉES" },
      ],
    });
    expect(out).toContain("FACTORY");
    expect(out).toContain("DONNÉE NON FIABLE");
    expect(out).not.toContain("DONNÉES");
  });

  it("active la politique non-fiable quand untrustedBlocks présent", () => {
    const out = composeSystem("FACTORY", baseDef, {
      ...baseCtx,
      untrustedBlocks: [
        { kind: "document", label: "contrat.pdf", text: "CLAUSE SECRÈTE" },
      ],
    });
    expect(out).toContain("DONNÉE NON FIABLE");
    expect(out).not.toContain("CLAUSE SECRÈTE");
  });

  it("n'ajoute PAS la politique sans contenu non-fiable", () => {
    const out = composeSystem("FACTORY", baseDef, baseCtx);
    expect(out).not.toContain("DONNÉE NON FIABLE");
  });
});

describe("filterTools", () => {
  const allTools = {
    legifrance_search: { description: "legi" },
    pappers_search: { description: "papp" },
    search_documents: { description: "rag" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  it("null → tous les outils retournés tels quels", () => {
    expect(Object.keys(filterTools(allTools, null))).toEqual(
      Object.keys(allTools)
    );
  });

  it("undefined → tous les outils", () => {
    expect(Object.keys(filterTools(allTools, undefined))).toEqual(
      Object.keys(allTools)
    );
  });

  it("liste vide → AUSSI tous les outils retournés (par convention base.ts)", () => {
    // Note: filterTools traite [] comme "pas de restriction" — c'est
    // runAgentStream qui interprète [] comme "aucun outil" et ne charge
    // pas les outils en amont. Ce test documente le contrat de filterTools.
    expect(Object.keys(filterTools(allTools, []))).toEqual(
      Object.keys(allTools)
    );
  });

  it("liste explicite → uniquement ces outils", () => {
    expect(
      Object.keys(filterTools(allTools, ["legifrance_search"]))
    ).toEqual(["legifrance_search"]);
  });

  it("liste avec outil inconnu → ignoré, pas d'erreur", () => {
    expect(
      Object.keys(filterTools(allTools, ["legifrance_search", "inconnu"]))
    ).toEqual(["legifrance_search"]);
  });
});
