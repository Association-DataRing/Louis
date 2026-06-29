import { describe, expect, it } from "vitest";
import { PIPELINE_PRESETS, findPreset } from "./presets";
import { AGENT_DEFAULTS } from "./agents";
import type { AgentRole } from "./types";

describe("Presets: structure", () => {
  it("expose chat-simple, recherche-juridique et redaction-actes", () => {
    const slugs = PIPELINE_PRESETS.map((p) => p.slug);
    expect(slugs).toContain("chat-simple");
    expect(slugs).toContain("recherche-juridique");
    expect(slugs).toContain("redaction-actes");
  });

  it("chaque preset a au moins un agent", () => {
    for (const preset of PIPELINE_PRESETS) {
      expect(preset.agents.length).toBeGreaterThan(0);
    }
  });

  it("chaque preset a un slug unique", () => {
    const slugs = PIPELINE_PRESETS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("findPreset retourne le preset par slug, undefined si inconnu", () => {
    expect(findPreset("chat-simple")?.slug).toBe("chat-simple");
    expect(findPreset("inexistant")).toBeUndefined();
  });
});

describe("Presets: cohérence avec la table d'agents", () => {
  it("tous les rôles cités sont connus (AGENT_DEFAULTS + default-chat)", () => {
    const knownRoles = [
      "default-chat",
      ...Object.keys(AGENT_DEFAULTS),
    ] as AgentRole[];
    for (const preset of PIPELINE_PRESETS) {
      for (const agent of preset.agents) {
        expect(knownRoles).toContain(agent.role);
      }
    }
  });

  it("le preset recherche-juridique se termine par orchestrator (terminal)", () => {
    const preset = findPreset("recherche-juridique")!;
    expect(preset.agents[preset.agents.length - 1].role).toBe("orchestrator");
  });

  it("le preset redaction-actes se termine par orchestrator (terminal)", () => {
    const preset = findPreset("redaction-actes")!;
    expect(preset.agents[preset.agents.length - 1].role).toBe("orchestrator");
  });

  it("chat-simple est mono-agent default-chat", () => {
    const preset = findPreset("chat-simple")!;
    expect(preset.agents).toHaveLength(1);
    expect(preset.agents[0].role).toBe("default-chat");
  });
});

describe("Presets: allowlist d'outils", () => {
  it("le citateur dans recherche-juridique limite ses outils à legifrance_search", () => {
    const preset = findPreset("recherche-juridique")!;
    const citator = preset.agents.find((a) => a.role === "citator");
    expect(citator).toBeDefined();
    expect(citator!.toolAllowlist).toEqual(["legifrance_search"]);
  });

  it("Reviewer dans redaction-actes n'a aucun outil", () => {
    const preset = findPreset("redaction-actes")!;
    const reviewer = preset.agents.find((a) => a.role === "reviewer");
    expect(reviewer).toBeDefined();
    expect(reviewer!.toolAllowlist).toEqual([]);
  });
});
