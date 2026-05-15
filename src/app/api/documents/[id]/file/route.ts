import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { getObjectBytes } from "@/lib/storage";

type Params = { id: string };

/**
 * Sert le binaire d'un document de l'utilisateur.
 *
 * - `?download=1` → Content-Disposition attachment (force le download)
 * - sinon → inline (iframe peut afficher PDF directement, navigateur peut
 *   ouvrir DOCX dans la handler app si associée)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;
  const url = new URL(req.url);
  const forceDownload = url.searchParams.get("download") === "1";

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

  let bytes: Uint8Array;
  try {
    bytes = await getObjectBytes(doc.storageKey);
  } catch {
    return new Response("Storage error", { status: 500 });
  }

  const safeName = doc.filename.replace(/"/g, "");
  const disposition = forceDownload ? "attachment" : "inline";

  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
