import { describe, expect, it } from "vitest";
import { findNormalized, findNormalizedAdaptive, stripDiacritics } from "./text-highlight";

describe("stripDiacritics", () => {
  it("supprime les accents et met en minuscules", () => {
    expect(stripDiacritics("révélation")).toBe("revelation");
    expect(stripDiacritics("Ça va")).toBe("ca va");
    expect(stripDiacritics("naïve")).toBe("naive");
  });

  it("laisse les caractères ASCII inchangés", () => {
    expect(stripDiacritics("hello world")).toBe("hello world");
  });

  it("gère une chaîne vide", () => {
    expect(stripDiacritics("")).toBe("");
  });
});

describe("findNormalized", () => {
  it("retourne null si needle vide", () => {
    expect(findNormalized("texte source", "")).toBeNull();
  });

  it("retourne null si pas de match", () => {
    expect(findNormalized("bonjour le monde", "inexistant")).toBeNull();
  });

  it("match exact ASCII", () => {
    const result = findNormalized("bonjour le monde", "le monde");
    expect(result).toEqual([8, 16]);
  });

  it("match insensible à la casse", () => {
    const result = findNormalized("Bonjour Le Monde", "le monde");
    expect(result).not.toBeNull();
    const [start, end] = result!;
    expect("Bonjour Le Monde".slice(start, end)).toBe("Le Monde");
  });

  it("match NFC source / NFD needle (divergence pdfjs ↔ LLM)", () => {
    // "é" NFC = U+00E9 (source pdfjs NFC)
    // "é" NFD = e + U+0301 (needle LLM peut sortir NFD)
    const source = "la révolution";            // NFC
    const needle = "la révolution";      // NFD
    const result = findNormalized(source, needle);
    expect(result).not.toBeNull();
    const [start, end] = result!;
    expect(source.slice(start, end)).toBe("la révolution");
  });

  it("match NFD source / NFC needle (sens inverse)", () => {
    const source = "la révolution";      // NFD
    const needle = "la révolution";             // NFC
    const result = findNormalized(source, needle);
    expect(result).not.toBeNull();
  });

  it("retourne les bons indices dans la chaîne originale", () => {
    const source = "avant cible après";
    const result = findNormalized(source, "cible");
    expect(result).toEqual([6, 11]);
    expect(source.slice(6, 11)).toBe("cible");
  });

  it("match en début de chaîne", () => {
    const result = findNormalized("début de phrase", "début");
    expect(result).not.toBeNull();
    const [start, end] = result!;
    expect("début de phrase".slice(start, end)).toBe("début");
  });

  it("match en fin de chaîne", () => {
    const result = findNormalized("fin de la phrase", "phrase");
    expect(result).not.toBeNull();
    const [start, end] = result!;
    expect("fin de la phrase".slice(start, end)).toBe("phrase");
    expect(end).toBe("fin de la phrase".length);
  });

  it("match avec accents dans les deux", () => {
    const result = findNormalized(
      "l'article L. 442-1 relatif à la rupture",
      "relatif à la"
    );
    expect(result).not.toBeNull();
    const [start, end] = result!;
    expect("l'article L. 442-1 relatif à la rupture".slice(start, end)).toBe(
      "relatif à la"
    );
  });

  it("retourne null pour un needle plus long que la source", () => {
    expect(findNormalized("court", "beaucoup plus long que la source")).toBeNull();
  });
});

describe("findNormalizedAdaptive", () => {
  it("trouve avec le needle complet quand il matche (120 chars)", () => {
    const source = "avant " + "a".repeat(100) + " après";
    const needle = "a".repeat(100);
    expect(findNormalizedAdaptive(source, needle)).not.toBeNull();
  });

  it("replie sur 60 chars quand 120 chars ne matchent pas", () => {
    // source contient seulement les 60 premiers chars du needle
    const prefix = "b".repeat(60);
    const source = "avant " + prefix + " après";
    const needle = prefix + "X".repeat(60); // 120 chars, mais seuls les 60 premiers sont dans la source
    const result = findNormalizedAdaptive(source, needle);
    expect(result).not.toBeNull();
    const [start, end] = result!;
    expect(source.slice(start, end)).toBe(prefix);
  });

  it("replie sur 30 chars quand 120 et 60 ne matchent pas", () => {
    const prefix = "c".repeat(30);
    const source = "avant " + prefix + " après";
    const needle = prefix + "X".repeat(90); // 120 chars, 60 et 120 échouent, 30 réussit
    const result = findNormalizedAdaptive(source, needle);
    expect(result).not.toBeNull();
    const [start, end] = result!;
    expect(source.slice(start, end)).toBe(prefix);
  });

  it("retourne null si rien ne matche même avec le needle le plus court", () => {
    expect(findNormalizedAdaptive("quelque chose", "inexistant")).toBeNull();
  });

  it("retourne null si le needle normalisé est inférieur à 8 chars", () => {
    expect(findNormalizedAdaptive("texte source", "court")).toBeNull();
  });

  it("résultat identique à findNormalized pour un match direct", () => {
    const source = "l'article L. 442-1 relatif à la rupture brutale";
    const needle = "relatif à la rupture";
    expect(findNormalizedAdaptive(source, needle)).toEqual(
      findNormalized(source, needle)
    );
  });
});
