import { generateDocx } from "./docx";
import { generatePdf } from "./pdf";
import { putExport } from "./store";

export type DocFormat = "docx" | "pdf";

const CONTENT_TYPES: Record<DocFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

/**
 * Pipeline complet : titre + markdown -> Buffer -> stocké -> URL.
 * Le tool IA `generate_document` retourne juste cette URL au modèle, qui
 * la relaie en lien dans la conversation.
 */
export async function generateAndStore({
  format,
  title,
  contentMarkdown,
  userId,
}: {
  format: DocFormat;
  title: string;
  contentMarkdown: string;
  userId: string;
}): Promise<{ url: string; filename: string }> {
  const buffer =
    format === "docx"
      ? await generateDocx(title, contentMarkdown)
      : await generatePdf(title, contentMarkdown);

  const safe = title
    .replace(/[^a-zA-Z0-9_\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .trim();
  const filename = `${safe || "document"}.${format}`;

  const id = putExport(buffer, CONTENT_TYPES[format], filename, userId);
  return { url: `/api/exports/${id}`, filename };
}

export { getExport } from "./store";
