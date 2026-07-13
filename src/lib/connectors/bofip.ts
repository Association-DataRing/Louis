import { pisteFetch } from "./piste";
import { runTool, toolOk, type ToolResult } from "@/lib/tools/result";

export type BofipHit = {
  id: string;
  title: string;
  nature: string;
  date: string;
  nor: string;
  url: string;
  excerpt: string;
};

/**
 * Recherche dans la doctrine fiscale (BOFIP) via la sous-API Légifrance/PISTE
 * avec fond=CIRC (circulaires et instructions ministérielles).
 */
export async function bofipSearch(
  userId: string,
  query: string,
  opts?: { limit?: number }
): Promise<ToolResult<{ query: string; hits: BofipHit[]; total: number }>> {
  return runTool(async () => {
    const pageSize = Math.min(opts?.limit ?? 5, 10);

    type Raw = {
      results?: Array<{
        id?: string;
        cid?: string;
        titre?: string;
        nature?: string;
        dateDebut?: string;
        dateTexte?: string;
        nor?: string;
        origin?: string;
        texte?: string;
        sections?: Array<{ extracts?: Array<{ values?: string[] }> }>;
      }>;
      totalResultNumber?: number;
    };

    const r = await pisteFetch<Raw>(userId, "POST", "/dila/legifrance/lf-engine-app/search", {
      body: {
        fond: "CIRC",
        recherche: {
          champs: [
            {
              typeChamp: "ALL",
              operateur: "ET",
              criteres: [
                { valeur: query, operateur: "ET", typeRecherche: "UN_DES_MOTS" },
              ],
            },
          ],
          filtres: [],
          pageNumber: 1,
          pageSize,
          sort: "PERTINENCE",
          typePagination: "DEFAUT",
          operateur: "ET",
        },
      },
      serviceName: "BOFIP",
    });

    if (!r.ok) return r;

    const hits: BofipHit[] = (r.data.results ?? []).slice(0, pageSize).map((row) => {
      const id = row.id ?? row.cid ?? "";
      return {
        id,
        title: row.titre ?? "Document fiscal",
        nature: row.nature ?? "",
        date: row.dateDebut ?? row.dateTexte ?? "",
        nor: row.nor ?? "",
        url: id
          ? `https://www.legifrance.gouv.fr/circulaire/id/${id}`
          : "https://bofip.impots.gouv.fr",
        excerpt: (
          row.texte ??
          row.sections?.[0]?.extracts?.[0]?.values?.[0] ??
          ""
        ).slice(0, 280),
      };
    });

    return toolOk({ query, hits, total: r.data.totalResultNumber ?? 0 });
  });
}
