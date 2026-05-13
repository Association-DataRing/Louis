import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents } from "@/db/schema";

type Params = { id: string };

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
      extractedText: documents.extractedText,
      extractionStatus: documents.extractionStatus,
    })
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);

  if (!doc) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json(doc);
}
