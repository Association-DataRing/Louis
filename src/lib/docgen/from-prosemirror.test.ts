import { describe, it, expect } from "vitest";
import { editorJsonToSpec } from "./from-prosemirror";
import { parseInline } from "./markdown-blocks";

/**
 * Régression: le round-trip éditeur → DocumentSpec → (parseInline lors de la
 * génération DOCX) ne doit JAMAIS supprimer les `_` / `*` littéraux d'un acte,
 * ni les transformer en emphase.
 */
describe("editorJsonToSpec — round-trip texte littéral", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Contrat de bail" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Réf article_2 et clause 3 * 4 ; " },
          { type: "text", text: "important", marks: [{ type: "bold" }] },
          { type: "text", text: " puis fin_de_ligne." },
        ],
      },
    ],
  };

  it("préserve underscores/astérisques littéraux et le gras réel", () => {
    const spec = editorJsonToSpec(doc, "Sans titre");
    expect(spec.title).toBe("Contrat de bail");

    const para = spec.sections.find((s) => s.kind === "paragraph");
    expect(para).toBeDefined();
    const content = (para as { content: string }).content;

    const runs = parseInline(content);
    // Le texte visible reconstruit est intact (rien n'est avalé).
    expect(runs.map((r) => r.text).join("")).toBe(
      "Réf article_2 et clause 3 * 4 ; important puis fin_de_ligne."
    );
    // Seul "important" est en gras, aucun italique parasite.
    expect(runs.filter((r) => r.bold)).toEqual([
      { text: "important", bold: true },
    ]);
    expect(runs.some((r) => r.italic)).toBe(false);
    // Aucun backslash d'échappement ne fuit dans le rendu final.
    expect(runs.some((r) => r.text.includes("\\"))).toBe(false);
  });

  it("conserve les `_` dans un item de liste", () => {
    const listDoc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Titre" }] },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "champ_obligatoire" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const spec = editorJsonToSpec(listDoc, "Sans titre");
    const list = spec.sections.find((s) => s.kind === "list") as {
      items: { text: string; level: number }[];
    };
    expect(list).toBeDefined();
    expect(parseInline(list.items[0].text).map((r) => r.text).join("")).toBe(
      "champ_obligatoire"
    );
  });

  it("préserve les listes imbriquées (niveaux) et les items multi-paragraphes", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Titre" }] },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                // Item avec DEUX paragraphes — les deux doivent survivre.
                { type: "paragraph", content: [{ type: "text", text: "Clause un" }] },
                { type: "paragraph", content: [{ type: "text", text: "suite clause un" }] },
                // Sous-liste imbriquée → niveau 1.
                {
                  type: "orderedList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        { type: "paragraph", content: [{ type: "text", text: "sous-clause" }] },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Clause deux" }] },
              ],
            },
          ],
        },
      ],
    };
    const spec = editorJsonToSpec(doc, "Sans titre");
    const list = spec.sections.find((s) => s.kind === "list") as {
      ordered: boolean;
      items: { text: string; level: number }[];
    };
    expect(list).toBeDefined();
    expect(list.ordered).toBe(true);
    expect(list.items).toEqual([
      { text: "Clause un suite clause un", level: 0 },
      { text: "sous-clause", level: 1 },
      { text: "Clause deux", level: 0 },
    ]);
  });
});
