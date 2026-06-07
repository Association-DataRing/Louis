import { describe, it, expect } from "vitest";
import { parseInline } from "./markdown-blocks";

describe("parseInline", () => {
  it("parse le **gras** et l'_italique_ non échappés (markdown IA)", () => {
    expect(parseInline("un **mot** gras")).toEqual([
      { text: "un " },
      { text: "mot", bold: true },
      { text: " gras" },
    ]);
    expect(parseInline("un _mot_ italique")).toEqual([
      { text: "un " },
      { text: "mot", italic: true },
      { text: " italique" },
    ]);
    expect(parseInline("__gras__ aussi")).toEqual([
      { text: "gras", bold: true },
      { text: " aussi" },
    ]);
  });

  it("traite `\\_` et `\\*` échappés comme des littéraux (pas d'emphase)", () => {
    expect(parseInline("article\\_2")).toEqual([{ text: "article_2" }]);
    expect(parseInline("3 \\* 4 \\* 5")).toEqual([{ text: "3 * 4 * 5" }]);
    // Un placeholder à remplir ne doit pas devenir de l'italique.
    expect(parseInline("Le \\_\\_\\_\\_ soussigné")).toEqual([
      { text: "Le ____ soussigné" },
    ]);
  });

  it("préserve l'emphase réelle même au milieu de littéraux échappés", () => {
    const runs = parseInline("réf article\\_2 puis **clause** finale\\_x");
    expect(runs.map((r) => r.text).join("")).toBe(
      "réf article_2 puis clause finale_x"
    );
    expect(runs.filter((r) => r.bold)).toEqual([{ text: "clause", bold: true }]);
    expect(runs.some((r) => r.italic)).toBe(false);
    expect(runs.some((r) => r.text.includes("\\"))).toBe(false);
  });

  it("retourne un run unique pour un texte sans markup", () => {
    expect(parseInline("texte simple")).toEqual([{ text: "texte simple" }]);
  });

  it("ne casse pas sur un délimiteur orphelin", () => {
    // Une seule étoile sans fermeture reste littérale.
    expect(parseInline("a * b")).toEqual([{ text: "a * b" }]);
  });
});
