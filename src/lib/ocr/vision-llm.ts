/**
 * OCR par modèle de vision (multimodal), agnostique du provider. On rastérise
 * chaque page en image et on demande à un LLM vision-capable de la transcrire
 * en Markdown. Fonctionne avec N'IMPORTE QUELLE clé dont le modèle accepte des
 * images : OpenRouter (ex. Pixtral, le vision de Mistral), OpenAI (GPT-4o),
 * Anthropic (Claude), ou un endpoint local. C'est la voie « OCR via OpenRouter »
 * — impossible via l'endpoint OCR dédié de Mistral, possible via un modèle vision.
 */

import { generateText } from "ai";
import { loadProviderKey, modelFromKey } from "@/lib/providers/factory";
import { rasterizePdf } from "./rasterize";

const PAGE_PROMPT =
  "Tu es un moteur d'OCR. Transcris FIDÈLEMENT et INTÉGRALEMENT le texte de " +
  "cette page de document en Markdown : utilise # pour les titres, des listes " +
  "pour les énumérations, et des tableaux Markdown pour les tableaux. " +
  "N'ajoute AUCUN commentaire, AUCune introduction ni conclusion — renvoie " +
  "uniquement le contenu transcrit. Si la page est vide, renvoie une chaîne vide.";

/**
 * OCR d'un PDF via un modèle de vision choisi (clé + modelId de l'utilisateur).
 * Renvoie le Markdown concaténé page à page.
 */
export async function ocrWithVision(
  userId: string,
  buffer: Buffer,
  providerKeyId: string,
  modelId: string
): Promise<string> {
  const images = await rasterizePdf(buffer);
  if (images.length === 0) return "";

  const key = await loadProviderKey(userId, providerKeyId);
  const model = modelFromKey(key, modelId);

  const out: string[] = [];
  for (const png of images) {
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
    const { text } = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PAGE_PROMPT },
            { type: "image", image: dataUrl },
          ],
        },
      ],
    });
    const trimmed = (text ?? "").trim();
    if (trimmed) out.push(trimmed);
  }
  return out.join("\n\n").trim();
}
