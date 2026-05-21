import { decrypt } from "@/lib/crypto";
import type { ProviderKey } from "@/db/schema";

/**
 * Représentation unifiée d'un modèle remonté depuis l'API d'un provider.
 * Tous les providers exposent au moins un `id` et une `label`.
 */
export interface LiveModel {
  id: string;
  label: string;
  /** Hint dérivé (famille, taille, prix indicatif…). Optionnel. */
  hint?: string;
  /** Contexte max si disponible (utile pour l'UI de filtrage). */
  contextWindow?: number;
  /** Provenance détectée — chez OpenRouter on a un sous-provider d'origine. */
  vendor?: string;
}

/**
 * Erreur explicite quand l'appel à l'API du provider échoue. Permet à
 * l'UI d'afficher un message actionnable (clé invalide, baseURL faux…).
 */
export class LiveCatalogError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "LiveCatalogError";
  }
}

/**
 * Récupère la liste complète des modèles disponibles pour un provider
 * donné, en appelant son endpoint `/v1/models`. Format normalisé en
 * `LiveModel[]` indépendamment du shape spécifique de chaque provider.
 *
 * Stratégie par type :
 * - mistral / openai / albert : `GET {base}/v1/models` avec Bearer
 * - anthropic : `GET https://api.anthropic.com/v1/models` avec x-api-key +
 *   header `anthropic-version`
 * - openrouter : `GET https://openrouter.ai/api/v1/models` — ne demande
 *   pas d'auth, retourne 300+ modèles avec métadonnées riches
 * - scaleway : `GET {baseUrl}/models` (project URL requis)
 * - ovh : pas de catalogue global → on retombe sur le catalogue curé
 * - openai_compatible : `GET {baseUrl}/models` (Ollama, vLLM, LiteLLM)
 */
export async function fetchLiveModels(
  key: ProviderKey
): Promise<LiveModel[]> {
  const apiKey = decrypt({
    ciphertext: key.apiKeyCiphertext,
    iv: key.apiKeyIv,
    tag: key.apiKeyTag,
  });

  switch (key.type) {
    case "mistral":
      return fetchOpenAiCompat(
        "https://api.mistral.ai/v1/models",
        apiKey
      );
    case "openai":
      return fetchOpenAiCompat(
        "https://api.openai.com/v1/models",
        apiKey
      );
    case "albert":
      return fetchOpenAiCompat(
        "https://albert.api.etalab.gouv.fr/v1/models",
        apiKey
      );
    case "anthropic":
      return fetchAnthropic(apiKey);
    case "openrouter":
      return fetchOpenRouter(apiKey);
    case "scaleway": {
      if (!key.baseUrl)
        throw new LiveCatalogError("Scaleway nécessite un baseUrl.");
      return fetchOpenAiCompat(`${trimSlash(key.baseUrl)}/models`, apiKey);
    }
    case "openai_compatible": {
      if (!key.baseUrl)
        throw new LiveCatalogError(
          "Cette clé openai_compatible nécessite un baseUrl."
        );
      return fetchOpenAiCompat(`${trimSlash(key.baseUrl)}/models`, apiKey);
    }
    case "ovh":
      // OVH expose un endpoint par modèle, pas de catalogue global. On
      // remonte une erreur explicite — le UI redirigera vers la liste
      // curée locale.
      throw new LiveCatalogError(
        "OVHcloud expose un endpoint par modèle, pas de catalogue global. Utilisez la liste curée.",
        501
      );
    default: {
      const exhaustive: never = key.type;
      throw new LiveCatalogError(
        `Type de provider non supporté: ${exhaustive}`
      );
    }
  }
}

function trimSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

interface OpenAiModelsResponse {
  data: Array<{
    id: string;
    name?: string;
    description?: string;
    context_length?: number;
    context_window?: number;
    owned_by?: string;
  }>;
}

async function fetchOpenAiCompat(
  url: string,
  apiKey: string
): Promise<LiveModel[]> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new LiveCatalogError(
      `Échec de l'appel ${url} (HTTP ${res.status}). ${body.slice(0, 200)}`,
      res.status
    );
  }

  const data = (await res.json()) as OpenAiModelsResponse;
  if (!Array.isArray(data?.data)) {
    throw new LiveCatalogError(
      `Réponse inattendue de ${url} (data non-itérable).`
    );
  }

  return dedupeById(
    data.data
      .filter((m) => m.id && typeof m.id === "string")
      .map((m) => ({
        id: m.id,
        label: m.name?.trim() || prettyId(m.id),
        hint: m.description?.trim() || undefined,
        contextWindow: m.context_length ?? m.context_window ?? undefined,
        vendor: m.owned_by ?? undefined,
      }))
  );
}

/**
 * Certains providers renvoient le même id plusieurs fois (alias →
 * version concrète chez Mistral, doublons silencieux chez OpenRouter…).
 * On garde la première occurrence pour éviter les warnings React
 * « duplicate key » et stabilise le rendu.
 */
function dedupeById(models: LiveModel[]): LiveModel[] {
  const seen = new Set<string>();
  const result: LiveModel[] = [];
  for (const m of models) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    result.push(m);
  }
  return result;
}

interface AnthropicModelsResponse {
  data: Array<{
    id: string;
    display_name?: string;
    created_at?: string;
    type?: string;
  }>;
}

async function fetchAnthropic(apiKey: string): Promise<LiveModel[]> {
  const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new LiveCatalogError(
      `Échec Anthropic /models (HTTP ${res.status}). ${body.slice(0, 200)}`,
      res.status
    );
  }

  const data = (await res.json()) as AnthropicModelsResponse;
  return dedupeById(
    (data.data ?? [])
      .filter((m) => m.id)
      .map((m) => ({
        id: m.id,
        label: m.display_name?.trim() || prettyId(m.id),
        hint: m.created_at
          ? `Disponible depuis ${m.created_at.slice(0, 10)}`
          : undefined,
        vendor: "anthropic",
      }))
  );
}

interface OpenRouterModelsResponse {
  data: Array<{
    id: string;
    name?: string;
    description?: string;
    context_length?: number;
    pricing?: {
      prompt?: string;
      completion?: string;
    };
    architecture?: {
      modality?: string;
    };
  }>;
}

async function fetchOpenRouter(apiKey: string): Promise<LiveModel[]> {
  // OpenRouter /models est documenté comme public mais retourne parfois
  // 401 sans Authorization. On passe la clé + les headers attribution
  // (HTTP-Referer, X-Title) qu'OpenRouter recommande pour identifier
  // l'app appelante.
  // Important : les headers HTTP doivent être ASCII pur. Pas d'em-dash
  // (—, U+2014) ni d'accents dans X-Title sinon ByteString throw côté
  // fetch.
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/Association-DataRing/Louis",
      "X-Title": "Louis - orchestrateur IA souverain",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new LiveCatalogError(
      `Échec OpenRouter /models (HTTP ${res.status}).`,
      res.status
    );
  }

  const data = (await res.json()) as OpenRouterModelsResponse;
  return dedupeById(
    (data.data ?? [])
      .filter((m) => m.id)
      .map((m) => {
        const vendor = m.id.includes("/") ? m.id.split("/")[0] : undefined;
        const priceHint = formatOpenRouterPricing(m.pricing);
        const ctxHint = m.context_length
          ? `${(m.context_length / 1000).toFixed(0)}k ctx`
          : undefined;
        const hints = [vendor, ctxHint, priceHint].filter(Boolean);
        return {
          id: m.id,
          label: m.name?.trim() || prettyId(m.id),
          hint: hints.length > 0 ? hints.join(" · ") : undefined,
          contextWindow: m.context_length,
          vendor,
        };
      })
  );
}

function formatOpenRouterPricing(
  pricing: { prompt?: string; completion?: string } | undefined
): string | undefined {
  if (!pricing) return undefined;
  const promptN = Number(pricing.prompt);
  if (!isFinite(promptN) || promptN === 0) return undefined;
  // Pricing en $ par token côté OpenRouter — on convertit en $/M tokens.
  const perM = promptN * 1_000_000;
  if (perM < 0.01) return `$${perM.toFixed(3)}/M`;
  return `$${perM.toFixed(2)}/M`;
}

/**
 * Convertit un id de modèle technique en label "raisonnable" quand le
 * provider ne donne pas de display_name.
 */
function prettyId(id: string): string {
  const base = id.split("/").pop() ?? id;
  return base
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
