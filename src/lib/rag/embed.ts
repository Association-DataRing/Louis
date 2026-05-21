import { embedMany } from "ai";
import { createMistral } from "@ai-sdk/mistral";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { providerKeys } from "@/db/schema";
import { decrypt } from "@/lib/crypto";

const EMBEDDING_MODEL = "mistral-embed";
const BATCH_SIZE = 64;

export class NoEmbeddingProviderError extends Error {
  constructor() {
    super(
      "Aucun provider Mistral actif. Le RAG documents nécessite une clé Mistral en v0.1."
    );
    this.name = "NoEmbeddingProviderError";
  }
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

export async function embedTexts(
  userId: string,
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = await loadMistralKey(userId);
  const mistral = createMistral({ apiKey });
  const model = mistral.embedding(EMBEDDING_MODEL);

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
