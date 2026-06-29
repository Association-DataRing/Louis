import { pisteFetch } from "./piste";
import { runTool, toolOk, type ToolResult } from "@/lib/tools/result";

const JUDILIBRE_BASE = "/cassation/judilibre/v1.0";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JudilibreDecision = {
  id: string;
  number: string;
  ecli: string;
  formation: string;
  solution: string;
  decision_date: string;
  jurisdiction: string;
  chamber: string;
  themes: string[];
  summary: string;
  text: string;
};

type JudilibreSearchRaw = {
  results: JudilibreDecision[];
  total: number;
  next_page: string | null;
};

export type JudilibreHit = {
  id: string;
  ecli: string;
  title: string;
  date: string;
  solution: string;
  chamber: string;
  themes: string[];
  summary: string;
  url: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function judilibreUrl(id: string): string {
  return `https://www.courdecassation.fr/decision/${id}`;
}

function buildSearchParams(opts: {
  query: string;
  jurisdiction?: string;
  chamber?: string;
  date_start?: string;
  date_end?: string;
  sort?: string;
  page_size?: number;
}): string {
  const params = new URLSearchParams();
  if (opts.query) params.set("query", opts.query);
  if (opts.jurisdiction) params.set("jurisdiction", opts.jurisdiction);
  if (opts.chamber) params.set("chamber", opts.chamber);
  if (opts.date_start) params.set("date_start", opts.date_start);
  if (opts.date_end) params.set("date_end", opts.date_end);
  params.set("sort", opts.sort ?? "score");
  params.set("order", "desc");
  params.set("page_size", String(Math.min(opts.page_size ?? 5, 50)));
  return params.toString();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function judilibreSearch(
  userId: string,
  query: string,
  opts?: {
    jurisdiction?: string;
    chamber?: string;
    date_start?: string;
    date_end?: string;
  }
): Promise<ToolResult<{ query: string; hits: JudilibreHit[]; total: number }>> {
  return runTool(async () => {
    const qs = buildSearchParams({ query, ...opts, page_size: 5 });
    const r = await pisteFetch<JudilibreSearchRaw>(
      userId,
      "GET",
      `${JUDILIBRE_BASE}/search?${qs}`,
      { serviceName: "Judilibre" }
    );
    if (!r.ok) return r;

    const hits: JudilibreHit[] = (r.data.results ?? []).slice(0, 5).map((d) => ({
      id: d.id,
      ecli: d.ecli,
      title: `${d.jurisdiction} ${d.chamber} — ${d.number}`,
      date: d.decision_date,
      solution: d.solution,
      chamber: d.chamber,
      themes: d.themes?.slice(0, 3) ?? [],
      summary: d.summary?.slice(0, 400) ?? "",
      url: judilibreUrl(d.id),
    }));

    return toolOk({ query, hits, total: r.data.total });
  });
}

export async function judilibreGetDecision(
  userId: string,
  decisionId: string
): Promise<ToolResult<{ decision: JudilibreHit & { text: string } }>> {
  return runTool(async () => {
    const r = await pisteFetch<JudilibreDecision>(
      userId,
      "GET",
      `${JUDILIBRE_BASE}/decision?id=${encodeURIComponent(decisionId)}`,
      { serviceName: "Judilibre" }
    );
    if (!r.ok) return r;

    const d = r.data;
    return toolOk({
      decision: {
        id: d.id,
        ecli: d.ecli,
        title: `${d.jurisdiction} ${d.chamber} — ${d.number}`,
        date: d.decision_date,
        solution: d.solution,
        chamber: d.chamber,
        themes: d.themes ?? [],
        summary: d.summary ?? "",
        url: judilibreUrl(d.id),
        text: d.text?.slice(0, 8000) ?? "",
      },
    });
  });
}
