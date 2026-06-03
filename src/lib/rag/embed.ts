import { embedMany, type EmbeddingModel } from "ai";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { providerKeys } from "@/db/schema";
import { decrypt } from "@/lib/crypto";

const MISTRAL_EMBEDDING_MODEL = "mistral-embed";
const DEFAULT_SELFHOSTED_MODEL = "nomic-embed-text";
const BATCH_SIZE = 64;

export class NoEmbeddingProviderError extends Error {
  constructor() {
    super(
      "Aucun backend d'embedding disponible : configurez LOUIS_EMBEDDING_BASE_URL (endpoint OpenAI-compatible auto-hébergé) ou activez une clé Mistral."
    );
    this.name = "NoEmbeddingProviderError";
  }
}

/** Vrai si un backend d'embedding souverain (self-hosté) est configuré. */
function selfHostedBaseUrl(): string | undefined {
  return process.env.LOUIS_EMBEDDING_BASE_URL?.trim() || undefined;
}

async function loadMistralKey(userId: string): Promise<string> {
  const [key] = await db
    .select()
    .from(providerKeys)
    .where(
      and(
        eq(providerKeys.userId, userId),
        eq(providerKeys.type, "mistral"),
        eq(providerKeys.isActive, true)
      )
    )
    .limit(1);

  if (!key) throw new NoEmbeddingProviderError();

  return decrypt({
    ciphertext: key.apiKeyCiphertext,
    iv: key.apiKeyIv,
    tag: key.apiKeyTag,
  });
}

/**
 * Résout le modèle d'embedding. PRIORITÉ au backend self-hostable
 * (souveraineté) : si LOUIS_EMBEDDING_BASE_URL est défini, les embeddings sont
 * calculés sur un endpoint OpenAI-compatible (Ollama, vLLM, HF TEI…) — les
 * chunks de documents confidentiels ne quittent JAMAIS l'infra du cabinet.
 * Sinon, repli sur mistral-embed via la clé Mistral de l'utilisateur
 * (comportement historique).
 *
 * IMPORTANT : le modèle self-hosté DOIT produire des vecteurs de dimension
 * EMBEDDING_DIM (1024, cf. db/schema/document-chunks.ts). À défaut, ajuster
 * EMBEDDING_DIM dans le schéma et ré-indexer — Louis n'autorise qu'une seule
 * dimension par déploiement (pas de mélange à chaud).
 */
async function resolveEmbeddingModel(
  userId: string
): Promise<EmbeddingModel> {
  const baseUrl = selfHostedBaseUrl();
  if (baseUrl) {
    const model =
      process.env.LOUIS_EMBEDDING_MODEL?.trim() || DEFAULT_SELFHOSTED_MODEL;
    // Beaucoup de serveurs locaux n'exigent pas de clé ; on en fournit une
    // factice pour satisfaire le SDK quand LOUIS_EMBEDDING_API_KEY est absent.
    const apiKey = process.env.LOUIS_EMBEDDING_API_KEY?.trim() || "not-needed";
    return createOpenAI({ baseURL: baseUrl, apiKey }).embedding(model);
  }
  const apiKey = await loadMistralKey(userId);
  return createMistral({ apiKey }).embedding(MISTRAL_EMBEDDING_MODEL);
}

export async function embedTexts(
  userId: string,
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const model = await resolveEmbeddingModel(userId);

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const result = await embedMany({ model, values: batch });
    out.push(...result.embeddings);
  }
  return out;
}

export async function embedQuery(
  userId: string,
  query: string
): Promise<number[]> {
  const [vector] = await embedTexts(userId, [query]);
  return vector;
}
