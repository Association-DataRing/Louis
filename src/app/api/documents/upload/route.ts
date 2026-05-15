import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents, documentChunks } from "@/db/schema";
import { uploadObject, deleteObject } from "@/lib/storage";
import { extractText, isSupportedContentType } from "@/lib/extract";
import { chunkText } from "@/lib/rag/chunk";
import { embedTexts, NoEmbeddingProviderError } from "@/lib/rag/embed";
import { nanoid } from "nanoid";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response("Invalid form data", { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return new Response("Missing file", { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return new Response("File too large (max 25 MB)", { status: 413 });
  }

  if (!isSupportedContentType(file.type)) {
    return new Response(
      "Unsupported file type. Use PDF, DOCX or plain text.",
      { status: 415 }
    );
  }

  // When `replaces` is set, this upload is a new version of an existing
  // document. We inherit the project assignment from the parent and increment
  // the version counter for the whole family.
  const replacesRaw = formData.get("replaces");
  const replacesId =
    typeof replacesRaw === "string" && replacesRaw.length > 0
      ? replacesRaw
      : null;
  let parentDocumentId: string | null = null;
  let projectIdOverride: string | null = null;
  let nextVersion = 1;
  if (replacesId) {
    const [parent] = await db
      .select({
        id: documents.id,
        userId: documents.userId,
        projectId: documents.projectId,
        parentDocumentId: documents.parentDocumentId,
      })
      .from(documents)
      .where(and(eq(documents.id, replacesId), eq(documents.userId, userId)))
      .limit(1);
    if (!parent) {
      return new Response("Parent document not found", { status: 404 });
    }
    parentDocumentId = parent.parentDocumentId ?? parent.id;
    projectIdOverride = parent.projectId;
    const [{ max }] = await db
      .select({
        max: sql<number>`COALESCE(MAX(${documents.version}), 0)::int`,
      })
      .from(documents)
      .where(eq(documents.parentDocumentId, parentDocumentId));
    nextVersion = (max ?? 0) + 1;
    // The root document itself was at version 1, ensure new revisions go higher.
    if (parentDocumentId === parent.id && nextVersion < 2) nextVersion = 2;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = `${userId}/${nanoid()}-${file.name}`;

  try {
    await uploadObject(storageKey, buffer, file.type);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Storage error";
    return new Response(`Failed to store file: ${msg}`, { status: 500 });
  }

  let extractedText: string | null = null;
  let extractionStatus = "ok";
  let extractionError: string | null = null;

  try {
    const result = await extractText(buffer, file.type);
    extractedText = result.text;
    if (result.truncated) extractionStatus = "truncated";
  } catch (err) {
    extractionStatus = "failed";
    extractionError = err instanceof Error ? err.message : "Extraction failed";
  }

  let docId: string;
  try {
    const [row] = await db
      .insert(documents)
      .values({
        userId,
        projectId: projectIdOverride,
        parentDocumentId,
        version: nextVersion,
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        storageKey,
        extractedText,
        extractionStatus,
        extractionError,
      })
      .returning({ id: documents.id });
    docId = row.id;
  } catch (err) {
    await deleteObject(storageKey).catch(() => {});
    const msg = err instanceof Error ? err.message : "DB error";
    return new Response(`Failed to register document: ${msg}`, { status: 500 });
  }

  // Best-effort RAG indexation. Failures don't block the upload — the
  // document remains usable via system-prompt injection for small files.
  let indexedChunks = 0;
  let indexError: string | null = null;
  if (extractedText) {
    try {
      const chunks = chunkText(extractedText);
      if (chunks.length > 0) {
        const embeddings = await embedTexts(userId, chunks);
        await db.insert(documentChunks).values(
          chunks.map((content, i) => ({
            documentId: docId,
            chunkIndex: i,
            content,
            embedding: embeddings[i],
          }))
        );
        indexedChunks = chunks.length;
      }
    } catch (err) {
      if (err instanceof NoEmbeddingProviderError) {
        indexError = "no_mistral_key";
      } else {
        indexError = err instanceof Error ? err.message : "embedding_failed";
      }
    }
  }

  return Response.json({
    id: docId,
    extractionStatus,
    indexedChunks,
    indexError,
  });
}
