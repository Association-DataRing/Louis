import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { providerKeys } from "@/db/schema";
import { decrypt } from "@/lib/crypto";

/**
 * OCR souverain via Mistral OCR (déjà intégré comme provider). Renvoie du
 * Markdown structuré page à page — qualité élevée sur le juridique français,
 * tables et mises en page riches incluses. Nécessite une clé Mistral active.
 */

const OCR_ENDPOINT = "https://api.mistral.ai/v1/ocr";
const OCR_MODEL = "mistral-ocr-latest";

/** Renvoie la clé Mistral active de l'utilisateur, ou null si absente. */
export async function loadMistralKey(userId: string): Promise<string | null> {
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
  if (!key) return null;
  return decrypt({
    ciphertext: key.apiKeyCiphertext,
    iv: key.apiKeyIv,
    tag: key.apiKeyTag,
  });
}

type OcrResponse = { pages?: { markdown?: string }[] };

/** Exécute l'OCR Mistral sur un PDF et renvoie le Markdown concaténé. */
export async function ocrWithMistral(
  apiKey: string,
  buffer: Buffer
): Promise<string> {
  const dataUrl = `data:application/pdf;base64,${buffer.toString("base64")}`;
  const res = await fetch(OCR_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OCR_MODEL,
      document: { type: "document_url", document_url: dataUrl },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `OCR Mistral a échoué (${res.status}). ${detail.slice(0, 300)}`
    );
  }

  const json = (await res.json()) as OcrResponse;
  return (json.pages ?? [])
    .map((p) => p.markdown ?? "")
    .join("\n\n")
    .trim();
}
