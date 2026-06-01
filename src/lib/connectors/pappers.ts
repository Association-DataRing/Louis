import { loadConnectorCredentials } from "./runtime";
import {
  httpReason,
  runTool,
  toolError,
  toolOk,
  type ToolResult,
} from "@/lib/tools/result";

const BASE = "https://api.pappers.fr/v2";
const TIMEOUT_MS = 12_000;

type PappersCreds = { api_token: string };

export type PappersSearchResult = {
  nom_entreprise: string;
  siren: string;
  siret_siege?: string | null;
  forme_juridique?: string | null;
  domaine_activite?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  etat_administratif?: string | null;
};

export type PappersSearchResponse = {
  query: string;
  total: number;
  results: PappersSearchResult[];
};

export type PappersCompanyDetails = {
  nom_entreprise: string;
  siren: string;
  siret_siege?: string | null;
  forme_juridique?: string | null;
  date_creation?: string | null;
  capital?: number | null;
  effectif?: string | null;
  domaine_activite?: string | null;
  siege?: {
    adresse_ligne_1?: string | null;
    code_postal?: string | null;
    ville?: string | null;
  } | null;
  dirigeants?: Array<{
    nom?: string;
    prenom?: string;
    qualite?: string;
  }>;
};

async function pappersFetch<T>(
  userId: string,
  path: string,
  params: Record<string, string>
): Promise<ToolResult<T>> {
  const creds = await loadConnectorCredentials<PappersCreds>(userId, "pappers");
  if (!creds) {
    return toolError(
      "config",
      "Pappers n'est pas configuré ou est désactivé. Allez sur /connectors pour ajouter une clé."
    );
  }

  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_token", creds.credentials.api_token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, ...httpReason("Pappers", res.status) };
    }
    return toolOk((await res.json()) as T);
  } finally {
    clearTimeout(timer);
  }
}

export async function pappersSearch(
  userId: string,
  query: string
): Promise<ToolResult<PappersSearchResponse>> {
  return runTool(async () => {
    type Raw = {
      total?: number;
      resultats?: PappersSearchResult[];
    };
    const r = await pappersFetch<Raw>(userId, "/recherche", {
      q: query,
      precision: "standard",
      par_page: "5",
    });
    if (!r.ok) return r;
    return toolOk({
      query,
      total: r.data.total ?? 0,
      results: (r.data.resultats ?? []).slice(0, 5),
    });
  });
}

/**
 * R5 : teste le token Pappers via une recherche minimale. Consomme un appel
 * API réel (facturable selon le plan) — explicite et rare.
 */
export async function testPappersConnection(
  userId: string
): Promise<"ok" | "auth_error" | "config_error" | "network_error"> {
  const r = await pappersSearch(userId, "test");
  if (r.ok) return "ok";
  if (r.reason === "auth") return "auth_error";
  if (r.reason === "config") return "config_error";
  return "network_error";
}

export async function pappersGet(
  userId: string,
  siren: string
): Promise<ToolResult<PappersCompanyDetails>> {
  return runTool(() =>
    pappersFetch<PappersCompanyDetails>(userId, "/entreprise", {
      siren: siren.replace(/\s/g, ""),
    })
  );
}
