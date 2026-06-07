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
 * Représentation HTML éditable d'un document, pour alimenter l'éditeur
 * Tiptap du DocPanel.
 *
 * Contrairement à /preview (qui ne renvoie le HTML mammoth qu'en l'absence
 * de PDF LibreOffice), cette route convertit TOUJOURS le .docx en HTML —
 * c'est la source d'édition. Tiptap re-parse ce HTML via son schéma
 * (titres, gras/italique/souligné, listes, citations), ce qui agit aussi
 * comme filtre : les balises/inline styles non supportés sont ignorés.
 *
 * Réservé aux .docx : un PDF n'a pas de texte structuré ré-éditable → 415.
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
      filename: documents.filename,
      contentType: documents.contentType,
      storageKey: documents.storageKey,
    })
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);

  if (!doc) {
    return new Response("Not found", { status: 404 });
  }
  if (doc.contentType !== DOCX_MEDIA_TYPE) {
    return new Response("Document non éditable (PDF)", { status: 415 });
  }

  let html: string;
  try {
    const bytes = Buffer.from(await getObjectBytes(doc.storageKey));
    const result = await mammoth.convertToHtml({ buffer: bytes });
    html = result.value;
  } catch {
    return new Response("Conversion error", { status: 500 });
  }

  return Response.json({ filename: doc.filename, html });
}
