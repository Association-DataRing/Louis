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
      })(modelId);
    case "albert":
      return createOpenAI({
        apiKey,
        baseURL: "https://albert.api.etalab.gouv.fr/v1",
      })(modelId);
    case "ovh": {
      // OVH AI Endpoints have one URL per model. Users override via baseUrl.
      const base =
        key.baseUrl?.trim() ||
        `https://${modelId.toLowerCase().replace(/[^a-z0-9]/g, "-")}.endpoints.kepler.ai.cloud.ovh.net/api/openai_compat/v1`;
      return createOpenAI({ apiKey, baseURL: base })(modelId);
    }
    case "openai_compatible": {
      if (!key.baseUrl) throw new Error("baseUrl required for openai_compatible");
      return createOpenAI({ apiKey, baseURL: key.baseUrl })(modelId);
    }
    default: {
      const exhaustive: never = key.type;
      throw new Error(`Unsupported provider type: ${exhaustive}`);
    }
  }
}
