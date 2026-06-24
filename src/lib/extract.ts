/**
 * Server-side text extraction from PDF and DOCX documents.
 *
 * We cap extracted text at ~500K characters to stay within typical LLM
 * context windows. Le texte extrait alimente à la fois l'injection en
 * prompt système (petits fichiers) ET le pipeline RAG (chunking + embeddings
 * + recherche vectorielle pgvector), qui EST en production (cf. lib/rag/*).
 */

const MAX_TEXT_LENGTH = 500_000;

/**
 * En-dessous de ce nombre de caractères « utiles », un PDF est considéré
 * comme scanné (image sans couche texte). Seuil bas pour minimiser les faux
 * positifs sur de très courts documents.
 */
const SCANNED_PDF_MIN_CHARS = 20;

/**
 * Levée quand un PDF ne contient aucune couche texte exploitable (scanné).
 * Le message remonte tel quel dans documents.extractionError pour expliquer
 * à l'utilisateur pourquoi le document n'est ni indexé ni interrogeable.
 */
export class ScannedPdfError extends Error {
  constructor() {
    super(
      "PDF probablement scanné (aucune couche texte détectée) — un OCR est requis pour l'indexer et l'interroger."
    );
    this.name = "ScannedPdfError";
  }
}

export const PDF_MEDIA_TYPE = "application/pdf";
export const DOCX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const TEXT_MEDIA_TYPE = "text/plain";

/** Représentation du texte : Markdown structuré (PDF) ou texte brut. */
export type TextFormat = "markdown" | "text";

export type ExtractResult = {
  text: string;
  truncated: boolean;
  /**
   * Format du `text` produit. Les PDF ressortent désormais en Markdown
   * structuré (titres, paragraphes, listes) ; DOCX et texte brut restent en
   * `text`. Persisté dans `documents.text_format` et lu par le DocPanel pour
   * décider du rendu (Markdown vs brut).
   */
  format: TextFormat;
};

export async function extractText(
  buffer: Buffer,
  contentType: string
): Promise<ExtractResult> {
  let raw: string;
  let format: TextFormat = "text";

  if (contentType === PDF_MEDIA_TYPE) {
    // Conversion locale en Markdown structuré (souveraine, gratuite, hors-ligne).
    raw = await extractPdf(buffer);
    format = "markdown";
    // H17 : un PDF scanné ressort quasi vide → on le signale explicitement
    // plutôt que de l'enregistrer « ok » avec un texte vide (invisible RAG,
    // inutilisable en analyse tabulaire, sans aucun message à l'utilisateur).
    // L'appelant bascule alors vers l'OCR (cf. lib/ocr), qui renvoie lui aussi
    // du Markdown.
    if (raw.trim().length < SCANNED_PDF_MIN_CHARS) {
      throw new ScannedPdfError();
    }
  } else if (contentType === DOCX_MEDIA_TYPE) {
    raw = await extractDocx(buffer);
  } else if (contentType.startsWith("text/")) {
    raw = buffer.toString("utf8");
  } else {
    throw new Error(`Unsupported content type: ${contentType}`);
  }

  const truncated = raw.length > MAX_TEXT_LENGTH;
  return {
    text: truncated ? raw.slice(0, MAX_TEXT_LENGTH) : raw,
    truncated,
    format,
  };
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // Conversion structurée locale via pdfjs (cf. lib/pdf/to-markdown). Remplace
  // l'extraction texte-brut de pdf-parse : le Markdown produit devient la
  // représentation canonique du document partout (RAG, prompt, analyses,
  // affichage), unifiant le rendu avec celui de l'OCR.
  const { pdfToMarkdown } = await import("@/lib/pdf/to-markdown");
  return pdfToMarkdown(buffer);
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mod = await import("mammoth");
  const mammoth = (mod.default ?? mod) as typeof import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

export function isSupportedContentType(ct: string): boolean {
  return (
    ct === PDF_MEDIA_TYPE ||
    ct === DOCX_MEDIA_TYPE ||
    ct.startsWith("text/")
  );
}
