import { loadConnectorCredentials } from "./runtime";
import {
  httpReason,
  runTool,
  toolError,
  toolOk,
  type ToolResult,
} from "@/lib/tools/result";

const OAUTH_URL = "https://oauth.piste.gouv.fr/api/oauth/token";
const API_BASE = "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app";
const TIMEOUT_MS = 15_000;

/**
 * Construit l'URL Légifrance selon le TYPE de document, déduit du préfixe de
 * l'identifiant. Un article de code (`LEGIARTI`), une jurisprudence
 * (`JURITEXT`/`CETATEXT`), une loi/décret (`LEGITEXT`/`JORFTEXT`) et une
 * convention collective (`KALI…`) n'ont pas la même route. L'ancien code forçait
 * `/codes/article_lc/` pour TOUT → liens faux (jurisprudence, lois) présentés
 * comme « source officielle » par le citator. Type inconnu → page de recherche
 * plutôt qu'une URL d'article fabriquée.
 */
export function legifranceUrlForId(id: string): string {
  const base = "https://www.legifrance.gouv.fr";
  if (!id) return `${base}/`;
  if (id.startsWith("LEGIARTI")) return `${base}/codes/article_lc/${id}`;
  if (id.startsWith("LEGITEXT")) return `${base}/loda/id/${id}`;
  if (id.startsWith("JORFARTI") || id.startsWith("JORFTEXT"))
    return `${base}/jorf/id/${id}`;
  if (id.startsWith("JURITEXT")) return `${base}/juri/id/${id}`;
  if (id.startsWith("CETATEXT")) return `${base}/ceta/id/${id}`;
  if (id.startsWith("KALI")) return `${base}/conv_coll/id/${id}`;
  return `${base}/search/all?query=${encodeURIComponent(id)}`;
}

type PisteCreds = { client_id: string; client_secret: string };

type CachedToken = { token: string; expiresAt: number };
const tokenCache = new Map<string, CachedToken>();

async function getToken(userId: string): Promise<ToolResult<string>> {
  const cached = tokenCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return toolOk(cached.token);
  }

  const creds = await loadConnectorCredentials<PisteCreds>(userId, "piste");
  if (!creds) {
    return toolError(
      "config",
      "PISTE n'est pas configuré ou est désactivé. Ajoutez vos identifiants dans /connectors."
    );
  }

  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: creds.credentials.client_id,
      client_secret: creds.credentials.client_secret,
      scope: "openid",
    }),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      // Wipe the cache so a renewed key is picked up on next call.
      tokenCache.delete(userId);
      return toolError(
        "auth",
        "Les identifiants PISTE ont été refusés (OAuth 401/403). Renouvelez-les dans /connectors."
      );
    }
    return { ok: false, ...httpReason("PISTE OAuth", res.status) };
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  tokenCache.set(userId, {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, data.expires_in - 60) * 1000,
  });

  return toolOk(data.access_token);
}

export type ConnectorTestStatus =
  | "ok"
  | "auth_error"
  | "config_error"
  | "network_error";

/**
 * R5 : teste les identifiants PISTE en forçant un échange OAuth frais.
 * Consomme un appel OAuth réel (rare, explicite).
 */
export async function testPisteConnection(
  userId: string
): Promise<ConnectorTestStatus> {
  tokenCache.delete(userId);
  const r = await getToken(userId);
  if (r.ok) return "ok";
  if (r.reason === "auth") return "auth_error";
  if (r.reason === "config") return "config_error";
  return "network_error";
}

const PISTE_BASE = "https://api.piste.gouv.fr";

async function pisteRequest<T>(
  userId: string,
  path: string,
  body: unknown
): Promise<ToolResult<T>> {
  const tok = await getToken(userId);
  if (!tok.ok) return tok;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tok.data}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status === 401) tokenCache.delete(userId);
      return { ok: false, ...httpReason("Légifrance", res.status) };
    }
    return toolOk((await res.json()) as T);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Requête GET authentifiée vers PISTE. Utilisée par les sous-APIs qui
 * exposent des endpoints REST GET (ex: Judilibre).
 */
export async function pisteGet<T>(
  userId: string,
  path: string,
  serviceName = "PISTE"
): Promise<ToolResult<T>> {
  const tok = await getToken(userId);
  if (!tok.ok) return tok;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${PISTE_BASE}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tok.data}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status === 401) tokenCache.delete(userId);
      return { ok: false, ...httpReason(serviceName, res.status) };
    }
    return toolOk((await res.json()) as T);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Requête POST authentifiée vers PISTE avec basePath configurable.
 * Généralise pisteRequest pour cibler d'autres sous-APIs (ex: BOFIP via fond CIRC).
 */
export async function pistePost<T>(
  userId: string,
  fullPath: string,
  body: unknown,
  serviceName = "PISTE"
): Promise<ToolResult<T>> {
  const tok = await getToken(userId);
  if (!tok.ok) return tok;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${PISTE_BASE}${fullPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tok.data}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status === 401) tokenCache.delete(userId);
      return { ok: false, ...httpReason(serviceName, res.status) };
    }
    return toolOk((await res.json()) as T);
  } finally {
    clearTimeout(timer);
  }
}

export type LegifranceHit = {
  id: string;
  title: string;
  url: string;
  excerpt?: string;
};

export async function legifranceSearch(
  userId: string,
  query: string,
  fond: "ALL" | "CODE_DATE" | "JURI" = "ALL"
): Promise<ToolResult<{ query: string; hits: LegifranceHit[] }>> {
  return runTool(async () => {
    type Raw = {
      results?: Array<{
        id?: string;
        titles?: Array<{ title?: string; cid?: string }>;
        sections?: Array<{ extracts?: Array<{ values?: string[] }> }>;
        texte?: string;
      }>;
    };

    const r = await pisteRequest<Raw>(userId, "/search", {
      recherche: {
        champs: [
          {
            typeChamp: "ALL",
            criteres: [{ typeRecherche: "EXACTE", valeur: query }],
          },
        ],
        pageNumber: 1,
        pageSize: 5,
        typePagination: "DEFAUT",
        sort: "PERTINENCE",
        fond,
      },
    });
    if (!r.ok) return r;

    const hits: LegifranceHit[] = (r.data.results ?? [])
      .slice(0, 5)
      .map((row) => {
        const id = row.id ?? row.titles?.[0]?.cid ?? "";
        const title =
          row.titles?.[0]?.title ?? id ?? "Résultat sans titre";
        const excerpt =
          row.texte ??
          row.sections?.[0]?.extracts?.[0]?.values?.[0] ??
          undefined;
        return {
          id,
          title,
          url: legifranceUrlForId(id),
          excerpt: excerpt?.slice(0, 280),
        };
      });

    return toolOk({ query, hits });
  });
}
