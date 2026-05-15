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
      // Invalidate the cached token on 401 so the next call refreshes it.
      if (res.status === 401) tokenCache.delete(userId);
      return { ok: false, ...httpReason("Légifrance", res.status) };
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
          url: id
            ? `https://www.legifrance.gouv.fr/codes/article_lc/${id}`
            : "https://www.legifrance.gouv.fr/",
          excerpt: excerpt?.slice(0, 280),
        };
      });

    return toolOk({ query, hits });
  });
}
