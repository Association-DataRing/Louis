import { describe, expect, it } from "vitest";
import {
  AGENT_DEFAULTS,
  CITATOR_SYSTEM_PROMPT,
  DRAFTING_SYSTEM_PROMPT,
  LEGIFRANCE_SYSTEM_PROMPT,
  ORCHESTRATOR_SYSTEM_PROMPT,
  RESEARCH_SYSTEM_PROMPT,
  REVIEWER_SYSTEM_PROMPT,
} from "./index";
import { composeSystem, filterTools } from "./default";
import type { AgentContext, AgentDefinition } from "../types";

describe("AGENT_DEFAULTS: table des rôles spécialisés", () => {
  it("default-chat n'est PAS dans la table (fallback runDefaultAgent)", () => {
    expect(AGENT_DEFAULTS["default-chat"]).toBeUndefined();
  });

  it("research : sourcing large, prompt dédié", () => {
    expect(AGENT_DEFAULTS.research?.systemPrompt).toBe(RESEARCH_SYSTEM_PROMPT);
    expect(AGENT_DEFAULTS.research?.toolAllowlist).toEqual([
      "legifrance_search",
      "pappers_search",
      "pappers_get",
      "search_documents",
    ]);
  });

  it("citator : un seul outil de vérification", () => {
    expect(AGENT_DEFAULTS.citator?.systemPrompt).toBe(CITATOR_SYSTEM_PROMPT);
    expect(AGENT_DEFAULTS.citator?.toolAllowlist).toEqual(["legifrance_search"]);
  });

  it("reviewer : aucun outil (analyse de texte pure)", () => {
    expect(AGENT_DEFAULTS.reviewer?.systemPrompt).toBe(REVIEWER_SYSTEM_PROMPT);
    expect(AGENT_DEFAULTS.reviewer?.toolAllowlist).toEqual([]);
  });

  it("orchestrator : tous les outils (terminal de synthèse)", () => {
    expect(AGENT_DEFAULTS.orchestrator?.systemPrompt).toBe(
      ORCHESTRATOR_SYSTEM_PROMPT
    );
    expect(AGENT_DEFAULTS.orchestrator?.toolAllowlist).toBeNull();
  });

  it("drafting : génération + édition de documents", () => {
    expect(AGENT_DEFAULTS.drafting?.systemPrompt).toBe(DRAFTING_SYSTEM_PROMPT);
    expect(AGENT_DEFAULTS.drafting?.toolAllowlist).toContain("generate_document");
  });

  it("legifrance : sourcing Légifrance focalisé", () => {
    expect(AGENT_DEFAULTS.legifrance?.systemPrompt).toBe(
      LEGIFRANCE_SYSTEM_PROMPT
    );
    expect(AGENT_DEFAULTS.legifrance?.toolAllowlist).toEqual(["legifrance_search"]);
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
