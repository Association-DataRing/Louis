import { describe, it, expect } from "vitest";
import { diffLines, diffStats, collapseDiff, MAX_DP_LINES } from "./line-diff";

describe("diffLines", () => {
  it("renvoie tout en « eq » pour deux textes identiques", () => {
    const { ops, truncated } = diffLines("a\nb\nc", "a\nb\nc");
    expect(truncated).toBe(false);
    expect(ops.every((o) => o.type === "eq")).toBe(true);
    expect(ops.map((o) => o.text)).toEqual(["a", "b", "c"]);
  });

  it("détecte une ligne ajoutée au milieu", () => {
    const { ops } = diffLines("a\nc", "a\nb\nc");
    expect(ops).toEqual([
      { type: "eq", text: "a" },
      { type: "add", text: "b" },
      { type: "eq", text: "c" },
    ]);
  });

  it("détecte une ligne supprimée au milieu", () => {
    const { ops } = diffLines("a\nb\nc", "a\nc");
    expect(ops).toEqual([
      { type: "eq", text: "a" },
      { type: "del", text: "b" },
      { type: "eq", text: "c" },
    ]);
  });

  it("traite une modification comme suppression + ajout", () => {
    const { ops } = diffLines("titre\nancien\nfin", "titre\nnouveau\nfin");
    expect(ops).toContainEqual({ type: "del", text: "ancien" });
    expect(ops).toContainEqual({ type: "add", text: "nouveau" });
    // le préfixe et le suffixe communs restent « eq »
    expect(ops[0]).toEqual({ type: "eq", text: "titre" });
    expect(ops[ops.length - 1]).toEqual({ type: "eq", text: "fin" });
  });

  it("ajout pur à partir d'un texte vide", () => {
    const { ops } = diffLines("", "x\ny");
    // "" → [""] côté ancien ; "" est préfixe commun avec "" du nouveau split ?
    // Le nouveau "x\ny" → ["x","y"], l'ancien "" → [""]. Pas de préfixe commun.
    expect(diffStats(ops).added).toBeGreaterThanOrEqual(2);
    expect(diffStats(ops).removed).toBeLessThanOrEqual(1);
  });

  it("normalise les fins de ligne CRLF", () => {
    const { ops } = diffLines("a\r\nb", "a\nb");
    expect(ops.every((o) => o.type === "eq")).toBe(true);
  });

  it("préserve l'ordre : préfixe, divergence, suffixe", () => {
    const { ops } = diffLines("h1\nh2\nold\nf1", "h1\nh2\nnew1\nnew2\nf1");
    const texts = ops.map((o) => `${o.type}:${o.text}`);
    expect(texts[0]).toBe("eq:h1");
    expect(texts[1]).toBe("eq:h2");
    expect(texts[texts.length - 1]).toBe("eq:f1");
    expect(texts).toContain("del:old");
    expect(texts).toContain("add:new1");
    expect(texts).toContain("add:new2");
  });

  it("tronque (bloc remplacé) au-delà du plafond DP", () => {
    // Région divergente > MAX_DP_LINES de chaque côté, sans préfixe/suffixe commun.
    const old = Array.from({ length: MAX_DP_LINES + 50 }, (_, i) => `o${i}`).join(
      "\n"
    );
    const next = Array.from(
      { length: MAX_DP_LINES + 50 },
      (_, i) => `n${i}`
    ).join("\n");
    const { ops, truncated } = diffLines(old, next);
    expect(truncated).toBe(true);
    const stats = diffStats(ops);
    expect(stats.removed).toBe(MAX_DP_LINES + 50);
    expect(stats.added).toBe(MAX_DP_LINES + 50);
  });

  it("le trim préfixe/suffixe évite la troncature même sur un gros document", () => {
    // Énorme corps identique, une seule ligne modifiée → DP minuscule.
    const body = Array.from({ length: 5000 }, (_, i) => `ligne ${i}`);
    const old = [...body, "AVANT", ...body].join("\n");
    const next = [...body, "APRÈS", ...body].join("\n");
    const { ops, truncated } = diffLines(old, next);
    expect(truncated).toBe(false);
    expect(ops).toContainEqual({ type: "del", text: "AVANT" });
    expect(ops).toContainEqual({ type: "add", text: "APRÈS" });
  });
});

describe("collapseDiff", () => {
  it("replie les plages identiques lointaines en gap, garde le contexte", () => {
    const body = Array.from({ length: 20 }, (_, i) => `l${i}`);
    const { ops } = diffLines(
      body.join("\n"),
      [...body.slice(0, 10), "INSÉRÉ", ...body.slice(10)].join("\n")
    );
    const display = collapseDiff(ops, 2);
    // un gap au début (avant le contexte) et un à la fin
    expect(display.some((o) => o.type === "gap")).toBe(true);
    // le changement et son contexte immédiat sont conservés
    expect(display).toContainEqual({ type: "add", text: "INSÉRÉ" });
    // pas de plage « eq » de plus de `context` lignes consécutives hors gap
    const eqRun = display.filter((o) => o.type === "eq").length;
    expect(eqRun).toBeLessThanOrEqual(4 + 1); // 2 de contexte de chaque côté
  });

  it("ne crée pas de gap quand tout est proche d'un changement", () => {
    const { ops } = diffLines("a\nb", "a\nc");
    const display = collapseDiff(ops, 3);
    expect(display.some((o) => o.type === "gap")).toBe(false);
  });
});

describe("diffStats", () => {
  it("compte les ajouts et suppressions", () => {
    expect(
      diffStats([
        { type: "eq", text: "a" },
        { type: "add", text: "b" },
        { type: "add", text: "c" },
        { type: "del", text: "d" },
      ])
    ).toEqual({ added: 2, removed: 1 });
  });
});
