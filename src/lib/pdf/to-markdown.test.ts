import { describe, it, expect, vi, beforeEach } from "vitest";

// État partagé avec le mock — muté par chaque test avant appel.
const state = vi.hoisted(() => ({ items: [] as unknown[] }));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({
        getTextContent: async () => ({ items: state.items }),
        cleanup: () => {},
      }),
      destroy: async () => {},
    }),
  }),
}));

import { pdfToMarkdown } from "./to-markdown";

// Helper : construit un RawItem avec les paramètres essentiels.
// transform[3] = taille de police, transform[4] = x, transform[5] = y.
function item(str: string, size: number, x: number, y: number, width = 200) {
  return { str, transform: [0, 0, 0, size, x, y], width };
}

beforeEach(() => {
  state.items = [];
});

describe("pdfToMarkdown", () => {
  it("PDF sans couche texte → chaîne vide", async () => {
    state.items = [];
    expect(await pdfToMarkdown(Buffer.from(""))).toBe("");
  });

  it("item grande police (ratio ≥ 1.5) → titre H1", async () => {
    // body = 12 (taille dominante), heading = 24 → ratio 2.0 ≥ 1.5
    state.items = [
      item("Article 1er", 24, 72, 720, 150),
      // texte corps (body dominant pour bodySize)
      item("Premier alinéa du document juridique.", 12, 72, 680, 400),
      item("Suite du paragraphe avec suffisamment de texte.", 12, 72, 668, 400),
    ];
    const md = await pdfToMarkdown(Buffer.from(""));
    expect(md).toContain("# Article 1er");
  });

  it("item taille intermédiaire (1.1 ≤ ratio < 1.5) → titre H3", async () => {
    // body = 10, heading = 12 → ratio 1.2, ≥ H3 (1.1) et < H2 (1.25) : H3
    state.items = [
      item("Sous-section", 12, 72, 720, 150),
      item("texte corps suffisant pour fixer bodySize à 10", 10, 72, 680, 500),
      item("deuxième ligne corps pour confirmer body 10", 10, 72, 668, 500),
    ];
    const md = await pdfToMarkdown(Buffer.from(""));
    expect(md).toContain("### Sous-section");
  });

  it("item préfixé bullet → élément de liste Markdown", async () => {
    state.items = [
      item("• Premier point de liste", 12, 72, 720, 300),
    ];
    const md = await pdfToMarkdown(Buffer.from(""));
    expect(md).toContain("- Premier point de liste");
  });

  it("item préfixé numéro → liste ordonnée Markdown", async () => {
    state.items = [
      item("1. Première obligation contractuelle", 12, 72, 720, 300),
    ];
    const md = await pdfToMarkdown(Buffer.from(""));
    expect(md).toContain("1. Première obligation contractuelle");
  });

  it("texte corps standard → paragraphe sans préfixe", async () => {
    state.items = [
      item("Le présent contrat est soumis au droit français.", 12, 72, 720, 400),
    ];
    const md = await pdfToMarkdown(Buffer.from(""));
    expect(md).toContain("Le présent contrat est soumis au droit français.");
    expect(md).not.toMatch(/^#/m);
    expect(md).not.toMatch(/^-\s/m);
  });
});
