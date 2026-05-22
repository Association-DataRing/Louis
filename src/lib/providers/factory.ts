import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { and, eq } from "drizzle-orm";
import type { LanguageModel } from "ai";
import { db } from "@/db";
import { providerKeys, type ProviderKey } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { DEFAULT_MODEL } from "./models";

export async function loadProviderKey(
  userId: string,
  providerKeyId: string
): Promise<ProviderKey> {
  const [key] = await db
    .select()
    .from(providerKeys)
    .where(
      and(eq(providerKeys.id, providerKeyId), eq(providerKeys.userId, userId))
    )
    .limit(1);

  if (!key) throw new Error("Provider key not found");
  if (!key.isActive) throw new Error("Provider key is inactive");
  return key;
}

/**
 * Build an AI SDK LanguageModel from a stored, encrypted provider key.
 *
 * Mistral and Anthropic use their dedicated SDK adapters. Everything else
 * (Scaleway, Albert, OVH, OpenAI, generic openai_compatible) is served via
 * the OpenAI adapter with a custom baseURL — they all speak the OpenAI
 * Chat Completions protocol.
 */
export function modelFromKey(
  key: ProviderKey,
  modelOverride?: string | null
): LanguageModel {
  const apiKey = decrypt({
    ciphertext: key.apiKeyCiphertext,
    iv: key.apiKeyIv,
    tag: key.apiKeyTag,
  });

  const modelId = modelOverride || DEFAULT_MODEL[key.type];

  // Note `.chat(modelId)` sur tous les providers OpenAI-compatible
  // (scaleway, albert, ovh, openai_compatible, openrouter) : depuis
  // @ai-sdk/openai v3 (AI SDK v6), l'appel direct `(modelId)` route
  // par défaut vers /v1/responses (Responses API, OpenAI-only). Les
  // providers compatibles renvoient alors 422 « ROUTE NOT SUPPORTED ».
  // `.chat(modelId)` force /v1/chat/completions, qui est universel.
  switch (key.type) {
    case "mistral":
      return createMistral({ apiKey })(modelId);
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    case "scaleway":
      return createOpenAI({
        apiKey,
        baseURL: "https://api.scaleway.ai/v1",
      }).chat(modelId);
    case "albert":
      return createOpenAI({
        apiKey,
        baseURL: "https://albert.api.etalab.gouv.fr/v1",
      }).chat(modelId);
    case "ovh": {
      // OVH AI Endpoints expose une URL différente PAR modèle. Les
      // utilisateurs peuvent surcharger via baseUrl ; sinon on déduit
      // l'URL depuis le modelId (kebab-case, suffixe `.endpoints.kepler...`).
      const base =
        key.baseUrl?.trim() ||
        `https://${modelId.toLowerCase().replace(/[^a-z0-9]/g, "-")}.endpoints.kepler.ai.cloud.ovh.net/api/openai_compat/v1`;
      return createOpenAI({ apiKey, baseURL: base }).chat(modelId);
    }
    case "openai_compatible": {
      if (!key.baseUrl) throw new Error("baseUrl required for openai_compatible");
      return createOpenAI({ apiKey, baseURL: key.baseUrl }).chat(modelId);
    }
    case "openrouter": {
      // OpenRouter expose une API OpenAI-compatible avec un catalogue
      // multi-providers (claude-3.5-sonnet, gpt-4o, llama-3.1-405b…).
      // Les headers HTTP-Referer / X-Title sont optionnels mais
      // recommandés pour figurer dans les attributions sur openrouter.ai.
      return createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        // ASCII pur obligatoire dans les headers HTTP — l'em-dash —
        // (U+2014) fait throw fetch « character > 255 ». Tiret simple
        // suffit pour l'attribution.
        headers: {
          "HTTP-Referer": "https://github.com/Association-DataRing/Louis",
          "X-Title": "Louis - orchestrateur IA souverain",
        },
      }).chat(modelId);
    }
    default: {
      const exhaustive: never = key.type;
      throw new Error(`Unsupported provider type: ${exhaustive}`);
    }
  }
}
