import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { providerKeys } from "@/db/schema";
import { decrypt } from "@/lib/crypto";

/**
 * OCR d'un PDF scanné via un provider SOUVERAIN déjà intégré (Mistral OCR).
 * Une part énorme des pièces juridiques françaises arrive en PDF scanné
 * (assignations, jugements signifiés, contrats manuscrits, PV d'huissier) ;
 * sans OCR elles étaient rejetées à l'upload, donc invisibles au RAG et à
 * l'analyse tabulaire. Cette passe les rend interrogeables.
 */
export class NoOcrProviderError extends Error {
  constructor() {
    super(
      "PDF scanné : OCR indisponible (aucune clé Mistral active pour l'OCR)."
    );
    this.name = "NoOcrProviderError";
  }
}

const OCR_ENDPOINT = "https://api.mistral.ai/v1/ocr";
const OCR_MODEL = "mistral-ocr-latest";

async function loadMistralKey(userId: string): Promise<string | null> {
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

/**
 * Renvoie le texte OCR d'un PDF (markdown concaténé page à page). Lève
 * NoOcrProviderError si aucun provider OCR n'est configuré.
 */
export async function ocrPdf(userId: string, buffer: Buffer): Promise<string> {
  const apiKey = await loadMistralKey(userId);
  if (!apiKey) throw new NoOcrProviderError();

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
    throw new Error(`OCR Mistral a échoué (${res.status}). ${detail.slice(0, 300)}`);
  }

  const json = (await res.json()) as OcrResponse;
  return (json.pages ?? [])
    .map((p) => p.markdown ?? "")
    .join("\n\n")
    .trim();
}
