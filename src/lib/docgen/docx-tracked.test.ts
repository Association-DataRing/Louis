import { describe, it, expect } from "vitest";
import { generateDocx } from "./docx";
import { applyTrackedEdits, extractDocxBodyText } from "./docx-tracked";

/**
 * Régression #8 : après une modification suivie, extractDocxBodyText (outil
 * read_document) doit refléter le texte COURANT — insertions incluses,
 * suppressions exclues — sinon le modèle relit un document faux et la 2ᵉ passe
 * d'édition échoue.
 */
describe("extractDocxBodyText sur un document à modifications suivies (#8)", () => {
  it("inclut le texte inséré et exclut le texte supprimé", async () => {
    const base = await generateDocx({
      title: "Bail",
      sections: [{ kind: "paragraph", content: "Le loyer est de 1000 euros." }],
    });

    const res = await applyTrackedEdits(base, [{ find: "1000", replace: "1200" }]);
    expect(res.applied.length).toBe(1);
    expect(res.errors.length).toBe(0);

    const text = await extractDocxBodyText(res.buffer);
    // Avant le fix : "Le loyer est de  euros." (insertion perdue, double espace).
    expect(text).toContain("Le loyer est de 1200 euros.");
    expect(text).not.toContain("1000");
  });
});
