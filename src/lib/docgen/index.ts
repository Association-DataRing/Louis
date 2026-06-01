import { nanoid } from "nanoid";
import { generateDocx } from "./docx";
import { generatePdf } from "./pdf";
import { docxToPdf } from "./libreoffice";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { uploadObject } from "@/lib/storage";
import { extractText } from "@/lib/extract";
import { log } from "@/lib/log";
import type { DocumentSpec } from "./types";

export type DocFormat = "docx" | "pdf";

const CONTENT_TYPES: Record<DocFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

/**
 * Génère un document à partir d'un DocumentSpec, le stocke dans S3 comme
 * tous les autres fichiers de l'utilisateur, crée une row dans `documents`
 * avec extracted_text calculé. Le document devient un citoyen de plein
 * droit (visible dans /documents, attachable au chat, indexable RAG…).
 *
 * Approche unifiée : pas de "fichiers éphémères" séparés, tout passe
 * par la même table — un avocat retrouvera la mise en demeure d'hier
 * dans son dossier client.
 */
export async function generateAndStore({
  format,
  spec,
  userId,
  projectId,
  folderId,
}: {
  format: DocFormat;
  spec: DocumentSpec;
  userId: string;
  projectId?: string | null;
  folderId?: string | null;
}): Promise<{ documentId: string; filename: string; format: DocFormat }> {
  const buffer =
    format === "docx" ? await generateDocx(spec) : await generatePdf(spec);
  const contentType = CONTENT_TYPES[format];

  const safe = spec.title
    .replace(/[^a-zA-Z0-9_\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .trim();
  const filename = `${safe || "document"}.${format}`;

  return storeBuffer({
    buffer,
    contentType,
    filename,
    userId,
    projectId,
    folderId,
  });
}

/**
 * Persiste un Buffer (docx ou pdf) dans S3 + row dans documents.
 * Utilisé par generate_document (sortie de generateDocx/Pdf) et par
 * edit_document (sortie de applyTrackedEdits).
 */
export async function storeBuffer({
  buffer,
  contentType,
  filename,
  userId,
  projectId,
  folderId,
}: {
  buffer: Buffer;
  contentType: string;
  filename: string;
  userId: string;
  projectId?: string | null;
  folderId?: string | null;
}): Promise<{ documentId: string; filename: string; format: DocFormat }> {
  const baseKey = `${userId}/louis-generated/${nanoid()}-${filename}`;
  await uploadObject(baseKey, buffer, contentType);

  // Extraction texte best-effort — permet au document généré d'être
  // attachable / cherchable comme n'importe quel upload utilisateur.
  let extractedText: string | null = null;
  let extractionStatus = "ok";
  let extractionError: string | null = null;
  try {
    const result = await extractText(buffer, contentType);
    extractedText = result.text;
    if (result.truncated) extractionStatus = "truncated";
  } catch (err) {
    extractionStatus = "failed";
    extractionError = err instanceof Error ? err.message : "Extraction failed";
  }

  // Pour les DOCX, on tente une conversion LibreOffice → PDF pour avoir
  // un preview visuellement identique à ce que l'utilisateur verra dans
  // Word. Échec silencieux : on retombe sur la preview HTML mammoth.
  let previewStorageKey: string | null = null;
  if (contentType === CONTENT_TYPES.docx) {
    const pdfBuffer = await docxToPdf(buffer);
    if (pdfBuffer) {
      previewStorageKey = `${baseKey}.preview.pdf`;
      try {
        await uploadObject(previewStorageKey, pdfBuffer, CONTENT_TYPES.pdf);
      } catch (err) {
        log.warn("docgen", "preview PDF upload failed", {
          error: err instanceof Error ? err.message : err,
        });
        previewStorageKey = null;
      }
    }
  }

  const [row] = await db
    .insert(documents)
    .values({
      userId,
      projectId: projectId ?? null,
      folderId: folderId ?? null,
      filename,
      contentType,
      sizeBytes: buffer.length,
      storageKey: baseKey,
      previewStorageKey,
      extractedText,
      extractionStatus,
      extractionError,
    })
    .returning({ id: documents.id });

  const format: DocFormat = contentType === CONTENT_TYPES.pdf ? "pdf" : "docx";
  return { documentId: row.id, filename, format };
}

export type { DocumentSpec, Section } from "./types";
