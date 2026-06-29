import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { getObjectBytes } from "@/lib/storage";
import { userCanAccessDocument } from "@/lib/projects/access";

type Params = { id: string };

/**
 * Sert le PDF de preview (rendu LibreOffice du DOCX) en inline, pour
 * iframe natif du DocPanel. Fidèle au rendu Word.
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
      previewStorageKey: documents.previewStorageKey,
    })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (
    !doc ||
    !doc.previewStorageKey ||
    !(await userCanAccessDocument(userId, id))
  ) {
    return new Response("Preview PDF non disponible", { status: 404 });
  }

  let bytes: Uint8Array;
  try {
    bytes = await getObjectBytes(doc.previewStorageKey);
  } catch {
    return new Response("Storage error", { status: 500 });
  }

  const safeName = doc.filename
    .replace(/\.docx$/i, ".pdf")
    .replace(/"/g, "");

  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
