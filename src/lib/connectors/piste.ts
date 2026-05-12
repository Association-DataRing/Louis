import { loadConnectorCredentials } from "./runtime";

const OAUTH_URL = "https://oauth.piste.gouv.fr/api/oauth/token";
const API_BASE = "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app";
const TIMEOUT_MS = 15_000;

type PisteCreds = { client_id: string; client_secret: string };

type CachedToken = { token: string; expiresAt: number };
const tokenCache = new Map<string, CachedToken>();

async function getToken(userId: string): Promise<string> {
  const cached = tokenCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const creds = await loadConnectorCredentials<PisteCreds>(userId, "piste");
  if (!creds) {
    throw new Error(
      "PISTE n'est pas configuré ou est désactivé. Ajoutez-le dans /connectors."
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
    throw new Error(`OAuth PISTE échoué (${res.status})`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  // Renew a minute before expiry so we never serve a stale token.
  tokenCache.set(userId, {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, data.expires_in - 60) * 1000,
  });

  return data.access_token;
}

async function pisteRequest<T>(
  userId: string,
  path: string,
  body: unknown
): Promise<T> {
  const token = await getToken(userId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Légifrance ${res.status} : ${text.slice(0, 200) || res.statusText}`
      );
    }
    return (await res.json()) as T;
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
): Promise<{ query: string; hits: LegifranceHit[] }> {
  type Raw = {
    results?: Array<{
      id?: string;
      titles?: Array<{ title?: string; cid?: string }>;
      sections?: Array<{ extracts?: Array<{ values?: string[] }> }>;
      texte?: string;
    }>;
  };

  const data = await pisteRequest<Raw>(userId, "/search", {
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

  const hits: LegifranceHit[] = (data.results ?? [])
    .slice(0, 5)
    .map((r) => {
      const id = r.id ?? r.titles?.[0]?.cid ?? "";
      const title = r.titles?.[0]?.title ?? id ?? "Résultat sans titre";
      const excerpt =
        r.texte ?? r.sections?.[0]?.extracts?.[0]?.values?.[0] ?? undefined;
      return {
        id,
        title,
        url: id
          ? `https://www.legifrance.gouv.fr/codes/article_lc/${id}`
          : "https://www.legifrance.gouv.fr/",
        excerpt: excerpt?.slice(0, 280),
      };
    });

  return { query, hits };
}
