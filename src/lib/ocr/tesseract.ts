/**
 * OCR 100 % local et souverain via Tesseract (tesseract.js), sans aucun appel
 * externe ni clé. Ultime fallback quand aucune clé OCR/vision n'est disponible :
 * Louis n'est jamais bloqué pour traiter un PDF scanné.
 *
 * Chaîne : rastérisation pdfjs → PNG (cf. rasterize.ts) → Tesseract reconnaît le
 * texte (français). Le résultat est du texte brut (valide comme Markdown) ; la
 * structure fine (titres, tables) reste l'apanage de l'OCR dédié / vision.
 *
 * Hors-ligne complet : Tesseract télécharge ses données de langue (fra) depuis
 * un CDN au premier usage, sauf si `TESSERACT_LANG_PATH` pointe vers un dossier
 * contenant `fra.traineddata(.gz)` (recommandé en déploiement souverain).
 */

import { rasterizePdf } from "./rasterize";

/** OCR local de toutes les pages, texte concaténé page à page. */
export async function ocrWithTesseract(buffer: Buffer): Promise<string> {
  const images = await rasterizePdf(buffer);
  if (images.length === 0) return "";

  const { createWorker } = await import("tesseract.js");
  const langPath = process.env.TESSERACT_LANG_PATH;
  const worker = await createWorker(
    "fra",
    1,
    langPath ? { langPath } : undefined
  );

  try {
    const out: string[] = [];
    for (const png of images) {
      const { data } = await worker.recognize(png);
      const text = (data.text ?? "").trim();
      if (text) out.push(text);
    }
    return out.join("\n\n").trim();
  } finally {
    await worker.terminate();
  }
}
