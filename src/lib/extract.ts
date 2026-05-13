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

type PdfTextItem = { str?: string };

async function extractPdf(buffer: Buffer): Promise<string> {
  // pdfjs-dist legacy build : pas de worker, fonctionne en Node pur. On
  // accède au sous-export sans le bundler (Turbopack ne tente pas de
  // résoudre `pdf.worker.mjs`).
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Désactive toute tentative de worker → tout tourne sur le main thread
  // côté serveur (acceptable car la latence d'extraction n'est pas critique).
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = "";
  }

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    useSystemFonts: true,
    disableFontFace: true,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = (content.items as PdfTextItem[])
      .map((item) => item.str ?? "")
      .join(" ");
    pages.push(text);
    page.cleanup();
  }
  await doc.destroy();
  return pages.join("\n");
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
