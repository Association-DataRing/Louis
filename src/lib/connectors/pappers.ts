import { loadConnectorCredentials } from "./runtime";

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
): Promise<T> {
  const creds = await loadConnectorCredentials<PappersCreds>(userId, "pappers");
  if (!creds) {
    throw new Error(
      "Pappers n'est pas configuré ou est désactivé. Configurez-le dans /connectors."
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
      throw new Error(`Pappers ${res.status} : ${res.statusText}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function pappersSearch(
  userId: string,
  query: string
): Promise<PappersSearchResponse> {
  type Raw = {
    total?: number;
    resultats?: PappersSearchResult[];
  };
  const data = await pappersFetch<Raw>(userId, "/recherche", {
    q: query,
    precision: "standard",
    par_page: "5",
  });
  return {
    query,
    total: data.total ?? 0,
    results: (data.resultats ?? []).slice(0, 5),
  };
}

export async function pappersGet(
  userId: string,
  siren: string
): Promise<PappersCompanyDetails> {
  return pappersFetch<PappersCompanyDetails>(userId, "/entreprise", {
    siren: siren.replace(/\s/g, ""),
  });
}
