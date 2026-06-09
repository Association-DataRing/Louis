import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("./runtime", () => ({
  loadConnectorCredentials: vi.fn().mockResolvedValue({
    key: { id: "test-key" },
    credentials: { client_id: "test-id", client_secret: "test-secret" },
  }),
  listActiveConnectorTypes: vi.fn().mockResolvedValue(["piste"]),
}));

describe("judilibre", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.resetModules();
  });

  describe("judilibreSearch", () => {
    it("construit la bonne URL GET avec les paramètres de recherche", async () => {
      // OAuth token response
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes("oauth.piste.gouv.fr")) {
          return {
            ok: true,
            json: async () => ({ access_token: "tok-123", expires_in: 300 }),
          };
        }
        if (url.includes("judilibre")) {
          return {
            ok: true,
            json: async () => ({
              results: [
                {
                  id: "dec-001",
                  number: "21-12.345",
                  ecli: "ECLI:FR:CCASS:2024:CO00123",
                  formation: "FP",
                  solution: "Cassation",
                  decision_date: "2024-03-15",
                  jurisdiction: "Cour de cassation",
                  chamber: "Chambre commerciale",
                  themes: ["contrats", "responsabilité"],
                  summary: "Résumé de la décision...",
                  text: "",
                },
              ],
              total: 42,
              next_page: null,
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      const { judilibreSearch } = await import("./judilibre");
      const result = await judilibreSearch("user-1", "rupture brutale", {
        jurisdiction: "cc",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.hits).toHaveLength(1);
      expect(result.data.hits[0].ecli).toBe("ECLI:FR:CCASS:2024:CO00123");
      expect(result.data.hits[0].solution).toBe("Cassation");
      expect(result.data.total).toBe(42);

      // Vérifie que le 2e appel est un GET vers Judilibre
      const judilibreCall = mockFetch.mock.calls.find((c) =>
        (c[0] as string).includes("judilibre")
      );
      expect(judilibreCall).toBeDefined();
      expect(judilibreCall![0]).toContain("/cassation/judilibre/v1.0/search");
      expect(judilibreCall![0]).toContain("query=rupture+brutale");
      expect(judilibreCall![0]).toContain("jurisdiction=cc");
      expect(judilibreCall![1].method).toBe("GET");
    });
  });

  describe("judilibreGetDecision", () => {
    it("récupère une décision par ID", async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes("oauth.piste.gouv.fr")) {
          return {
            ok: true,
            json: async () => ({ access_token: "tok-456", expires_in: 300 }),
          };
        }
        if (url.includes("judilibre")) {
          return {
            ok: true,
            json: async () => ({
              id: "dec-001",
              number: "21-12.345",
              ecli: "ECLI:FR:CCASS:2024:CO00123",
              formation: "FP",
              solution: "Rejet",
              decision_date: "2024-06-01",
              jurisdiction: "Cour de cassation",
              chamber: "Chambre sociale",
              themes: ["licenciement"],
              summary: "Attendu que...",
              text: "LA COUR DE CASSATION...",
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      const { judilibreGetDecision } = await import("./judilibre");
      const result = await judilibreGetDecision("user-1", "dec-001");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.decision.text).toContain("LA COUR DE CASSATION");
      expect(result.data.decision.url).toContain("dec-001");
    });
  });
});
