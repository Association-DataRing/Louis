/**
 * Server-side text extraction from PDF and DOCX documents.
 *
 * We cap extracted text at ~500K characters to stay within typical LLM
 * context windows. Larger documents will need a separate RAG pipeline
 * (chunking + embeddings + vector search) — not implemented in v0.1.
 */

const MAX_TEXT_LENGTH = 500_000;

export const PDF_MEDIA_TYPE = "application/pdf";
export const DOCX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const TEXT_MEDIA_TYPE = "text/plain";

export type ExtractResult = {
  text: string;
  truncated: boolean;
};

export async function extractText(
  buffer: Buffer,
  contentType: string
): Promise<ExtractResult> {
  let raw: string;

  if (contentType === PDF_MEDIA_TYPE) {
    raw = await extractPdf(buffer);
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
  };
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // unpdf is built on pdfjs-dist but ships a Node-friendly build that doesn't
  // need a worker. Works in serverless and standard Node alike.
  const { extractText } = await import("unpdf");
  const data = new Uint8Array(buffer);
  const result = await extractText(data, { mergePages: true });
  return Array.isArray(result.text) ? result.text.join("\n") : result.text;
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
