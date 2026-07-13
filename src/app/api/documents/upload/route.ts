import { eq, inArray, or, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents, documentChunks, documentFolders } from "@/db/schema";
import { uploadObject, deleteObject } from "@/lib/storage";
import {
  extractText,
  isSupportedContentType,
  ScannedPdfError,
} from "@/lib/extract";
import { ocrPdf } from "@/lib/ocr";
import { chunkText } from "@/lib/rag/chunk";
import { embedTexts, NoEmbeddingProviderError } from "@/lib/rag/embed";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  userCanAccessDocument,
  userCanAccessFolder,
} from "@/lib/projects/access";
import {
  generateDek,
  encryptWithDek,
  wrapDek,
} from "@/lib/crypto-envelope";
import { nanoid } from "nanoid";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  const rl = await rateLimit("upload", userId);
  if (!rl.allowed) return tooManyRequests(rl);

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
  // document. We inherit the parent's placement (folder = appartenance au
  // projet, et le projectId legacy) et increment the version counter for the
  // whole family. Sans héritage du folderId, une nouvelle version sortirait
  // du périmètre du projet.
  const replacesRaw = formData.get("replaces");
  const replacesId =
    typeof replacesRaw === "string" && replacesRaw.length > 0
      ? replacesRaw
      : null;
  let parentDocumentId: string | null = null;
  let projectIdOverride: string | null = null;
  let folderIdOverride: string | null = null;
  let nextVersion = 1;
  if (replacesId) {
    const [parent] = await db
      .select({
        id: documents.id,
        userId: documents.userId,
        projectId: documents.projectId,
        folderId: documents.folderId,
        parentDocumentId: documents.parentDocumentId,
      })
      .from(documents)
      .where(eq(documents.id, replacesId))
      .limit(1);
    // Accès : propriétaire du document ou collaborateur d'un projet le
    // contenant (un membre peut verser une nouvelle version dans le dossier
    // partagé).
    if (!parent || !(await userCanAccessDocument(userId, replacesId))) {
      return new Response("Parent document not found", { status: 404 });
    }
    parentDocumentId = parent.parentDocumentId ?? parent.id;
    projectIdOverride = parent.projectId;
    folderIdOverride = parent.folderId;
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

  // Folder assignment (only on fresh uploads — versions inherit their
  // placement from the parent document). Le dossier détermine l'appartenance
  // au projet (modèle dossier = projet).
  if (!replacesId) {
    const folderRaw = formData.get("folder");
    if (typeof folderRaw === "string" && folderRaw.length > 0) {
      const [folder] = await db
        .select({ id: documentFolders.id })
        .from(documentFolders)
        .where(eq(documentFolders.id, folderRaw))
        .limit(1);
      // Accès : propriétaire du dossier ou collaborateur d'un projet le
      // contenant (dépôt d'un document dans le dossier partagé).
      if (folder && (await userCanAccessFolder(userId, folder.id))) {
        folderIdOverride = folder.id;
      }
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Sanitize filename avant interpolation dans la storage key. Garde les
  // alphanumériques + . _ - tirets, tout le reste devient `_`. Coupe à 120
  // chars pour rester sous les limites usuelles des backends S3.
  const safeFilename =
    file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "file";
  const storageKey = `${userId}/${nanoid()}-${safeFilename}`;

  // --- Extraction de texte (sur le buffer en clair, avant chiffrement) ---
  let plainExtractedText: string | null = null;
  let textFormat: "text" | "markdown" = "text";
  let extractionStatus = "ok";
  let extractionError: string | null = null;

  try {
    const result = await extractText(buffer, file.type);
    plainExtractedText = result.text;
    textFormat = result.format;
    if (result.truncated) extractionStatus = "truncated";
  } catch (err) {
    // PDF scanné (aucune couche texte) → tentative d'OCR souverain plutôt que
    // de dead-end le document. Les pièces scannées (assignations, jugements
    // signifiés, PV d'huissier…) deviennent ainsi indexées et interrogeables.
    if (err instanceof ScannedPdfError) {
      try {
        // OCR pluggable : Mistral dédié / modèle vision (au choix) / Tesseract
        // local. Jamais bloquant — Tesseract est le plancher souverain.
        const ocr = await ocrPdf(userId, buffer);
        if (ocr.text.length > 0) {
          plainExtractedText = ocr.text;
          // Toutes les voies OCR renvoient du Markdown (texte brut compris).
          textFormat = "markdown";
          // `ocr` quand un moteur de qualité a opéré ; `ocr_degraded` quand on
          // a dû retomber sur Tesseract faute de clé — l'UI peut le signaler.
          extractionStatus = ocr.degraded ? "ocr_degraded" : "ocr";
        } else {
          extractionStatus = "failed";
          extractionError = err.message;
        }
      } catch (ocrErr) {
        extractionStatus = "failed";
        extractionError =
          ocrErr instanceof Error ? `OCR : ${ocrErr.message}` : "OCR failed";
      }
    } else {
      extractionStatus = "failed";
      extractionError = err instanceof Error ? err.message : "Extraction failed";
    }
  }

  // --- Chiffrement à enveloppe (ADR 0005 Phase 1) ---
  const dek = await generateDek();
  let encryptedBuffer: Buffer;
  let dekNonce: string;
  let encExtractedText: string | null = null;
  let extractedTextNonce: string | null = null;
  let encDek: string;
  try {
    const encBlob = await encryptWithDek(buffer, dek);
    encryptedBuffer = encBlob.ciphertext;
    dekNonce = encBlob.nonce;
    if (plainExtractedText) {
      const encText = await encryptWithDek(
        Buffer.from(plainExtractedText, "utf8"),
        dek
      );
      encExtractedText = encText.ciphertext.toString("base64");
      extractedTextNonce = encText.nonce;
    }
    encDek = wrapDek(dek);
  } finally {
    dek.fill(0);
  }

  // Upload du blob chiffré
  try {
    await uploadObject(storageKey, encryptedBuffer, file.type);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Storage error";
    return new Response(`Failed to store file: ${msg}`, { status: 500 });
  }

  let docId: string;
  try {
    const [row] = await db
      .insert(documents)
      .values({
        userId,
        projectId: projectIdOverride,
        folderId: folderIdOverride,
        parentDocumentId,
        version: nextVersion,
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        storageKey,
        encDek,
        dekNonce,
        encExtractedText,
        extractedTextNonce,
        textFormat,
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
  // Les chunks restent en clair (ADR 0005 §9 option A).
  let indexedChunks = 0;
  let indexError: string | null = null;
  if (plainExtractedText) {
    try {
      const chunks = chunkText(plainExtractedText);
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

  // R7 : purge les chunks des versions OBSOLÈTES de la famille. Sans cela,
  // ragSearch (qui interroge tous les documents du user) pouvait citer le
  // texte d'une v1 remplacée à la place de la v2 courante — un bug de
  // correction, pas qu'un détail. On ne supprime QUE les chunks : les rows
  // documents (historique des versions) restent intactes.
  if (replacesId && parentDocumentId) {
    const familyDocs = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        or(
          eq(documents.id, parentDocumentId),
          eq(documents.parentDocumentId, parentDocumentId)
        )
      );
    const staleIds = familyDocs
      .map((d) => d.id)
      .filter((id) => id !== docId);
    if (staleIds.length > 0) {
      await db
        .delete(documentChunks)
        .where(inArray(documentChunks.documentId, staleIds));
    }
  }

  return Response.json({
    id: docId,
    extractionStatus,
    indexedChunks,
    indexError,
  });
}
