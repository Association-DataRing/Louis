import { describe, expect, it } from "vitest";
import type { ModelMessage } from "ai";
import {
  buildUntrustedBlocks,
  hasUntrustedContext,
  injectUntrustedContext,
} from "./untrusted";
import type { AgentContext } from "./types";

const baseCtx: AgentContext = {
  userId: "u",
  conversationId: "c",
  messages: [],
};

describe("buildUntrustedBlocks", () => {
  it("retourne [] quand aucun contenu non-fiable", () => {
    expect(buildUntrustedBlocks(baseCtx)).toEqual([]);
  });

  it("concatène untrustedBlocks puis priorOutputs (en blocs agent-output)", () => {
    const blocks = buildUntrustedBlocks({
      ...baseCtx,
      untrustedBlocks: [{ kind: "document", label: "a.pdf", text: "X" }],
      priorOutputs: [
        { agentId: "p1", role: "research", label: "Recherche", output: "Y", round: 2 },
      ],
    });
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: "document", label: "a.pdf" });
    expect(blocks[1].kind).toBe("agent-output");
    expect(blocks[1].label).toContain("Recherche");
    expect(blocks[1].label).toContain("tour 2");
    expect(blocks[1].text).toBe("Y");
  });
});

describe("hasUntrustedContext", () => {
  it("faux sans contenu", () => {
    expect(hasUntrustedContext(baseCtx)).toBe(false);
  });
  it("vrai avec untrustedBlocks", () => {
    expect(
      hasUntrustedContext({
        ...baseCtx,
        untrustedBlocks: [{ kind: "skill", label: "s", text: "t" }],
      })
    ).toBe(true);
  });
  it("vrai avec priorOutputs", () => {
    expect(
      hasUntrustedContext({
        ...baseCtx,
        priorOutputs: [{ agentId: "p", role: "citator", label: "C", output: "o" }],
      })
    ).toBe(true);
  });
});

describe("injectUntrustedContext", () => {
  const history: ModelMessage[] = [
    { role: "user", content: "ancienne question" },
    { role: "assistant", content: "ancienne réponse" },
    { role: "user", content: "DEMANDE ACTUELLE" },
  ];

  it("renvoie le tableau inchangé sans contenu non-fiable", () => {
    expect(injectUntrustedContext(history, baseCtx)).toBe(history);
  });

  it("insère un message user non-fiable JUSTE AVANT le dernier message user", () => {
    const out = injectUntrustedContext(history, {
      ...baseCtx,
      untrustedBlocks: [{ kind: "document", label: "contrat.pdf", text: "CLAUSE" }],
    });
    expect(out).toHaveLength(history.length + 1);
    // Le dernier message reste la demande réelle.
    expect(out.at(-1)).toEqual({ role: "user", content: "DEMANDE ACTUELLE" });
    // L'avant-dernier est le bloc non-fiable.
    const injected = out.at(-2)!;
    expect(injected.role).toBe("user");
    expect(injected.content).toContain("DONNÉE NON FIABLE");
    expect(injected.content).toContain("contrat.pdf");
    expect(injected.content).toContain("CLAUSE");
  });

  it("emballe le contenu avec un marqueur traçable (en-tête + pied)", () => {
    const out = injectUntrustedContext(history, {
      ...baseCtx,
      untrustedBlocks: [{ kind: "document", label: "p.pdf", text: "corps" }],
    });
    const content = out.at(-2)!.content as string;
    expect(content).toMatch(/\[DONNÉE NON FIABLE · DOCUMENT JOINT · p\.pdf\]/);
    expect(content).toMatch(/\[FIN · p\.pdf\]/);
  });

  it("append en fin si aucun message user (cas dégénéré)", () => {
    const out = injectUntrustedContext(
      [{ role: "assistant", content: "x" }],
      { ...baseCtx, untrustedBlocks: [{ kind: "skill", label: "s", text: "t" }] }
    );
    expect(out).toHaveLength(2);
    expect(out.at(-1)!.role).toBe("user");
  });
});
