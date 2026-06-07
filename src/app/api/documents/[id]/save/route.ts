import { and, eq, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { generateDocx } from "@/lib/docgen/docx";
import { storeBuffer } from "@/lib/docgen";
import { editorJsonToSpec } from "@/lib/docgen/from-prosemirror";
import { recordAudit } from "@/lib/audit";

type Params = { id: string };

const DOCX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Sauvegarde une édition WYSIWYG (JSON Tiptap) comme NOUVELLE VERSION du
 * document : on ré-exporte en .docx via le pipeline maison (`generateDocx`),
 * rattaché à la famille du document d'origine (`parentDocumentId` = racine,
 * `version` = max + 1). On ne mute jamais le .docx existant — chaque save
 * crée une révision, cohérent avec le versioning légal de Louis.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  let body: { doc?: unknown };
  try {
    body = (await req.json()) as { doc?: unknown };
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!body.doc || typeof body.doc !== "object") {
    return new Response("Champ `doc` (JSON éditeur) requis.", { status: 400 });
  }

  const [src] = await db
    .select({
      id: documents.id,
      filename: documents.filename,
      contentType: documents.contentType,
      projectId: documents.projectId,
      folderId: documents.folderId,
      parentDocumentId: documents.parentDocumentId,
    })
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);

  if (!src) {
    return new Response("Not found", { status: 404 });
  }
  if (src.contentType !== DOCX_MEDIA_TYPE) {
    return new Response("Seuls les .docx sont éditables.", { status: 415 });
  }

  // Racine de la famille de versions : le parent direct, ou soi-même (v1).
  const rootId = src.parentDocumentId ?? src.id;

  // Prochain numéro de version = max de la famille + 1.
  const family = await db
    .select({ version: documents.version })
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        or(eq(documents.id, rootId), eq(documents.parentDocumentId, rootId))
      )
    );
  const nextVersion =
    family.reduce((max, r) => Math.max(max, r.version), 0) + 1;

  const stem = src.filename.replace(/\.[^.]+$/, "") || "document";
  const spec = editorJsonToSpec(
    body.doc as Parameters<typeof editorJsonToSpec>[0],
    stem
  );

  let buffer: Buffer;
  try {
    buffer = await generateDocx(spec);
  } catch {
    return new Response("Génération du document échouée", { status: 500 });
  }

  const result = await storeBuffer({
    buffer,
    contentType: DOCX_MEDIA_TYPE,
    filename: src.filename,
    userId,
    projectId: src.projectId,
    folderId: src.folderId,
    parentDocumentId: rootId,
    version: nextVersion,
  });

  // Audit : une nouvelle version d'un document est un livrable modifié —
  // tracé pour la défendabilité (doc.delete l'était déjà, pas doc.save).
  await recordAudit({
    userId,
    action: "doc.save",
    target: src.filename,
    meta: { version: nextVersion },
  });

  return Response.json({
    documentId: result.documentId,
    filename: result.filename,
    version: nextVersion,
  });
}
