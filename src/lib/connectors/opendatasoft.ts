import { toolError, toolOk, type ToolResult } from "@/lib/tools/result";

const DEFAULT_TIMEOUT_MS = 15_000;

type ODSSearchOptions = {
  q?: string;
  where?: string;
  orderBy?: string;
  limit?: number;
};

type ODSResult = {
  total_count: number;
  results: Record<string, unknown>[];
};

/**
 * Client générique pour les instances OpenDataSoft Explore v2.1.
 * Réutilisable pour BODACC, Infogreffe, UNEDIC, etc.
 * Aucune authentification requise pour ces endpoints publics.
 */
export async function odsSearch(
  baseUrl: string,
  datasetId: string,
  opts: ODSSearchOptions = {},
  serviceName = "OpenDataSoft"
): Promise<ToolResult<ODSResult>> {
  const url = new URL(
    `${baseUrl}/api/explore/v2.1/catalog/datasets/${datasetId}/records`
  );
  if (opts.q) url.searchParams.set("q", opts.q);
  if (opts.where) url.searchParams.set("where", opts.where);
  if (opts.orderBy) url.searchParams.set("order_by", opts.orderBy);
  url.searchParams.set("limit", String(opts.limit ?? 10));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status >= 500) {
        return toolError("server", `${serviceName} indisponible (${res.status}).`);
      }
      return toolError("unknown", `${serviceName} a renvoyé une erreur ${res.status}.`);
    }
    return toolOk((await res.json()) as ODSResult);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return toolError("timeout", `${serviceName} n'a pas répondu à temps.`);
    }
    return toolError("network", `Impossible de joindre ${serviceName}.`);
  } finally {
    clearTimeout(timer);
  }
}
