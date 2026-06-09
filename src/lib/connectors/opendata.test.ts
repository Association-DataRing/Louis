import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("bodacc", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("bodaccSearch", () => {
    it("interroge l'API OpenDataSoft BODACC et normalise les résultats", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total_count: 3,
          results: [
            {
              numeroannonce: "A-2024-001",
              familleavis_lib: "Procédure collective",
              typeavis_lib: "Jugement",
              commercant: "SAS EXAMPLE",
              dateparution: "2024-06-01",
              tribunal: "TC Paris",
              registre: "RCS Paris B 123 456 789",
              cp: "75001",
              ville: "Paris",
              url_complete: "https://www.bodacc.fr/annonce/A-2024-001",
            },
          ],
        }),
      });

      const { bodaccSearch } = await import("./bodacc");
      const result = await bodaccSearch("EXAMPLE", { departement: "75" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.hits).toHaveLength(1);
      expect(result.data.hits[0].id).toBe("BODACC-A-2024-001");
      expect(result.data.hits[0].type).toBe("Procédure collective");
      expect(result.data.hits[0].commercant).toBe("SAS EXAMPLE");
      expect(result.data.total).toBe(3);

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("bodacc-datadila.opendatasoft.com");
      expect(url).toContain("annonces-commerciales");
      expect(url).toContain("q=EXAMPLE");
      expect(url).toContain("numerodepartement");
    });

    it("gère une erreur serveur gracieusement", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      const { bodaccSearch } = await import("./bodacc");
      const result = await bodaccSearch("test");

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("server");
    });
  });
});
