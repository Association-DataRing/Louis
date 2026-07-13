import mammoth from "mammoth";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents } from "@/db/schema";
import {
  decryptDocumentText,
  fetchDocumentBytes,
} from "@/lib/document-crypto";
import { userCanAccessDocument } from "@/lib/projects/access";

type Params = { id: string };

const DOCX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Aperçu d'un document : texte extrait pour PDF/text, HTML structuré
 * (mammoth) pour DOCX afin de préserver titres, listes, paragraphes,
 * mise en forme inline. Le client (DocPanel) rend `html` en priorité
 * quand présent, sinon retombe sur extractedText.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const [doc] = await db
    .select({
      id: documents.id,
      filename: documents.filename,
      contentType: documents.contentType,
      sizeBytes: documents.sizeBytes,
      version: documents.version,
      storageKey: documents.storageKey,
      previewStorageKey: documents.previewStorageKey,
      extractedText: documents.extractedText,
      encDek: documents.encDek,
      encExtractedText: documents.encExtractedText,
      extractedTextNonce: documents.extractedTextNonce,
      dekNonce: documents.dekNonce,
      textFormat: documents.textFormat,
      extractionStatus: documents.extractionStatus,
    })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  // Accès : propriétaire ou collaborateur d'un projet contenant le document.
  if (!doc || !(await userCanAccessDocument(userId, id))) {
    return new Response("Not found", { status: 404 });
  }

  const extractedText = await decryptDocumentText(doc);

  // Preview HTML mammoth uniquement comme fallback quand pas de PDF
  // LibreOffice disponible. Sinon le client utilise preview-pdf.
  let html: string | null = null;
  if (doc.contentType === DOCX_MEDIA_TYPE && !doc.previewStorageKey) {
    try {
      const bytes = await fetchDocumentBytes(doc);
      const result = await mammoth.convertToHtml({ buffer: bytes });
      html = result.value;
    } catch {
      // pas de fallback hard — DocPanel utilisera extractedText
    }
  }

  return Response.json({
    id: doc.id,
    filename: doc.filename,
    contentType: doc.contentType,
    sizeBytes: doc.sizeBytes,
    version: doc.version,
    extractedText,
    textFormat: doc.textFormat,
    extractionStatus: doc.extractionStatus,
    hasPdfPreview: Boolean(doc.previewStorageKey),
    html,
  });
}
