import { describe, it, expect, vi, beforeEach } from "vitest";
import { legifranceUrlForId } from "./piste";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("./runtime", () => ({
  loadConnectorCredentials: vi.fn().mockResolvedValue({
    key: { id: "test-key" },
    credentials: { client_id: "test-id", client_secret: "test-secret" },
  }),
  listActiveConnectorTypes: vi.fn().mockResolvedValue(["piste"]),
}));

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

describe("legifranceSearch — payload conforme au SearchRequestDTO", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.resetModules();
  });

  it("place `fond` à la racine et les `operateur` requis (sinon erreur 500)", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("oauth.piste.gouv.fr")) {
        return {
          ok: true,
          json: async () => ({ access_token: "tok-123", expires_in: 300 }),
        };
      }
      return { ok: true, json: async () => ({ results: [] }) };
    });

    const { legifranceSearch } = await import("./piste");
    const res = await legifranceSearch("user-1", "responsabilité du fait des produits", "CODE_DATE");
    expect(res.ok).toBe(true);

    const searchCall = mockFetch.mock.calls.find((c) =>
      (c[0] as string).endsWith("/search")
    );
    expect(searchCall).toBeDefined();
    const body = JSON.parse(searchCall![1].body as string);

    // SearchRequestDTO.required = [fond, recherche] : fond DOIT être à la racine
    expect(body.fond).toBe("CODE_DATE");
    expect(body.recherche.fond).toBeUndefined();
    // RechercheSpecifiqueDTO.required inclut operateur
    expect(body.recherche.operateur).toBe("ET");
    // CritereDTO.required = [operateur, typeRecherche, valeur]
    const critere = body.recherche.champs[0].criteres[0];
    expect(critere.operateur).toBe("ET");
    expect(critere.typeRecherche).toBeTruthy();
    expect(critere.valeur).toBe("responsabilité du fait des produits");
  });
});
