import mammoth from "mammoth";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { getObjectBytes } from "@/lib/storage";

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
      storageKey: documents.storageKey,
      previewStorageKey: documents.previewStorageKey,
      extractedText: documents.extractedText,
      extractionStatus: documents.extractionStatus,
    })
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);

  if (!doc) {
    return new Response("Not found", { status: 404 });
  }

  // Preview HTML mammoth uniquement comme fallback quand pas de PDF
  // LibreOffice disponible. Sinon le client utilise preview-pdf.
  let html: string | null = null;
  if (doc.contentType === DOCX_MEDIA_TYPE && !doc.previewStorageKey) {
    try {
      const bytes = Buffer.from(await getObjectBytes(doc.storageKey));
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
    extractedText: doc.extractedText,
    extractionStatus: doc.extractionStatus,
    hasPdfPreview: Boolean(doc.previewStorageKey),
    html,
  });
}
