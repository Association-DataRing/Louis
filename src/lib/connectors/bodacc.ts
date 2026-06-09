import { odsSearch } from "./opendatasoft";
import { runTool, toolOk, type ToolResult } from "@/lib/tools/result";

const BODACC_BASE = "https://bodacc-datadila.opendatasoft.com";
const DATASET_ID = "annonces-commerciales";

export type BodaccHit = {
  id: string;
  type: string;
  commercant: string;
  date: string;
  tribunal: string;
  registre: string;
  ville: string;
  url: string;
};

type BodaccRecord = Record<string, string | undefined>;

function escapeOdsql(value: string): string {
  return value.replace(/'/g, "''").replace(/\\/g, "\\\\");
}

export async function bodaccSearch(
  query: string,
  opts?: { departement?: string; famille?: string; date_start?: string; date_end?: string }
): Promise<ToolResult<{ query: string; hits: BodaccHit[]; total: number }>> {
  return runTool(async () => {
    const whereParts: string[] = [];
    if (opts?.date_start) whereParts.push(`dateparution >= '${escapeOdsql(opts.date_start)}'`);
    if (opts?.date_end) whereParts.push(`dateparution <= '${escapeOdsql(opts.date_end)}'`);
    if (opts?.departement) whereParts.push(`numerodepartement = '${escapeOdsql(opts.departement)}'`);
    if (opts?.famille) whereParts.push(`familleavis_lib like '${escapeOdsql(opts.famille)}'`);

    const r = await odsSearch(BODACC_BASE, DATASET_ID, {
      q: query,
      where: whereParts.length > 0 ? whereParts.join(" AND ") : undefined,
      orderBy: "dateparution desc",
      limit: 5,
    }, "BODACC");

    if (!r.ok) return r;

    const hits: BodaccHit[] = (r.data.results ?? []).slice(0, 5).map((raw) => {
      const rec = raw as BodaccRecord;
      return {
        id: `BODACC-${rec.numeroannonce || ""}`,
        type: rec.familleavis_lib || rec.typeavis_lib || "Annonce",
        commercant: rec.commercant || "N/A",
        date: rec.dateparution || "",
        tribunal: rec.tribunal || "",
        registre: rec.registre || "",
        ville: `${rec.cp || ""} ${rec.ville || ""}`.trim(),
        url: rec.url_complete || "https://www.bodacc.fr/pages/annonces-commerciales/",
      };
    });

    return toolOk({ query, hits, total: r.data.total_count ?? 0 });
  });
}
