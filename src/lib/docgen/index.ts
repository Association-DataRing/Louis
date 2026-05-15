import { generateDocx } from "./docx";
import { generatePdf } from "./pdf";
import { putExport } from "./store";
import type { DocumentSpec } from "./types";

export type DocFormat = "docx" | "pdf";

const CONTENT_TYPES: Record<DocFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

/**
 * Pipeline complet : DocumentSpec structuré -> Buffer -> store TTL -> URL.
 * Utilisé par le tool IA generate_document et par edit_document (pour le
 * download du DOCX modifié).
 */
export async function generateAndStore({
  format,
  spec,
  userId,
  filenameOverride,
}: {
  format: DocFormat;
  spec: DocumentSpec;
  userId: string;
  filenameOverride?: string;
}): Promise<{ url: string; filename: string }> {
  const buffer =
    format === "docx" ? await generateDocx(spec) : await generatePdf(spec);

  const safe = (filenameOverride ?? spec.title)
    .replace(/[^a-zA-Z0-9_\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .trim();
  const filename = `${safe || "document"}.${format}`;

  const id = putExport(buffer, CONTENT_TYPES[format], filename, userId);
  return { url: `/api/exports/${id}`, filename };
}

/**
 * Stocke un buffer arbitraire (utilisé par edit_document après manipulation
 * du DOCX original via tracked changes) en réutilisant le mécanisme TTL.
 */
export function storeBuffer({
  buffer,
  contentType,
  filename,
  userId,
}: {
  buffer: Buffer;
  contentType: string;
  filename: string;
  userId: string;
}): { url: string; filename: string } {
  const id = putExport(buffer, contentType, filename, userId);
  return { url: `/api/exports/${id}`, filename };
}

export { getExport } from "./store";
export type { DocumentSpec, Section } from "./types";
