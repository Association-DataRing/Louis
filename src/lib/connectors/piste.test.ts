import { describe, it, expect } from "vitest";
import { legifranceUrlForId } from "./piste";

describe("legifranceUrlForId", () => {
  it("route un article de code vers /codes/article_lc/", () => {
    expect(legifranceUrlForId("LEGIARTI000006419292")).toBe(
      "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006419292"
    );
  });

  it("route une jurisprudence vers /juri/id/ (et non un article de code)", () => {
    expect(legifranceUrlForId("JURITEXT000047000000")).toBe(
      "https://www.legifrance.gouv.fr/juri/id/JURITEXT000047000000"
    );
    expect(legifranceUrlForId("CETATEXT000045000000")).toBe(
      "https://www.legifrance.gouv.fr/ceta/id/CETATEXT000045000000"
    );
  });

  it("route une loi/décret vers /loda/id/ ou /jorf/id/", () => {
    expect(legifranceUrlForId("LEGITEXT000006069414")).toBe(
      "https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006069414"
    );
    expect(legifranceUrlForId("JORFTEXT000000000000")).toBe(
      "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000000000000"
    );
  });

  it("route une convention collective vers /conv_coll/id/", () => {
    expect(legifranceUrlForId("KALICONT000005635185")).toBe(
      "https://www.legifrance.gouv.fr/conv_coll/id/KALICONT000005635185"
    );
  });

  it("id inconnu → recherche, jamais une URL d'article fabriquée", () => {
    const url = legifranceUrlForId("INCONNU123");
    expect(url).toContain("/search/all");
    expect(url).not.toContain("/codes/article_lc/");
  });

  it("id vide → page d'accueil", () => {
    expect(legifranceUrlForId("")).toBe("https://www.legifrance.gouv.fr/");
  });
});
