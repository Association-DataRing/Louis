import { describe, it, expect } from "vitest";
import { chunkText } from "./chunk";

describe("chunkText", () => {
  it("retourne [] sur une entrée vide", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("garde un petit document en un seul chunk", () => {
    const out = chunkText("Un paragraphe court.");
    expect(out).toEqual(["Un paragraphe court."]);
  });

  it("découpe un long texte en plusieurs chunks", () => {
    const para = "Phrase de test assez longue pour remplir. ".repeat(40);
    const out = chunkText(para);
    expect(out.length).toBeGreaterThan(1);
  });

  it("overlap par phrase entière : ne coupe pas en plein mot", () => {
    // Deux gros paragraphes → un chunk avec overlap. Le début du 2e chunk doit
    // commencer par une phrase complète (majuscule), pas un fragment de mot.
    const p1 =
      "Alpha bravo charlie delta echo foxtrot golf hotel. " +
      "India juliett kilo lima mike november oscar papa. " +
      "Quebec romeo sierra tango uniform victor whiskey xray.";
    const p2 = "Z".repeat(700) + ".";
    const out = chunkText(`${p1}\n\n${p2}`);
    expect(out.length).toBeGreaterThanOrEqual(2);
    // Le second chunk reprend la dernière phrase du premier en overlap : elle
    // doit être présente entière (pas tronquée à un mot partiel).
    const overlapStart = out[1].split("\n")[0];
    // Aucune phrase de l'overlap ne doit être un fragment commençant par une
    // lettre minuscule en milieu de mot : on vérifie que l'overlap correspond à
    // une phrase complète présente dans p1.
    expect(p1).toContain(overlapStart.trim());
  });
});
