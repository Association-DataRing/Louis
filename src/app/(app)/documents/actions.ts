"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/permissions";
import { db } from "@/db";
import { documents, documentFolders, documentChunks } from "@/db/schema";
import { deleteObject } from "@/lib/storage";
import { recordAudit } from "@/lib/audit";
import { reindexDocument, type ReindexResult } from "@/lib/rag/index-document";
import { diffLines, collapseDiff, type DisplayOp } from "@/lib/diff/line-diff";
import { decryptDocumentText } from "@/lib/document-crypto";

export async function deleteDocument(id: string): Promise<void> {
  const userId = await requireUserId();

  const [doc] = await db
    .select({ storageKey: documents.storageKey, filename: documents.filename })
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);

  if (!doc) return;

  await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)));

  await deleteObject(doc.storageKey).catch(() => {
    // Object may already be gone — DB delete is the source of truth.
  });

  await recordAudit({
    userId,
    action: "doc.delete",
    target: doc.filename,
  });

  revalidatePath("/documents");
  revalidatePath("/chat");
}

/** R6 : réindexation RAG d'un document (recovery après ajout de clé Mistral
 * ou échec d'embedding). Idempotent — remplace les chunks existants. */
export async function reindexDocumentAction(
  documentId: string
): Promise<ReindexResult> {
  const userId = await requireUserId();
  const result = await reindexDocument(userId, documentId);
  revalidatePath("/documents");
  return result;
}

/** R6 : réindexe les documents de l'utilisateur.
 * Par défaut (`onlyUnindexed: true`), ignore les documents déjà indexés
 * (qui ont au moins un chunk) — utile après ajout de clé Mistral.
 * `onlyUnindexed: false` force la ré-indexation complète (après changement
 * de modèle d'embedding). */
export async function reindexAllDocumentsAction(
  opts: { onlyUnindexed?: boolean } = {}
): Promise<{ indexed: number; failed: number; noKey: boolean; skipped: number }> {
  const { onlyUnindexed = true } = opts;
  const userId = await requireUserId();

  const allDocs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        or(
          isNotNull(documents.extractedText),
          isNotNull(documents.encExtractedText)
        )
      )
    );

  let docsToProcess = allDocs;
  let skipped = 0;

  if (onlyUnindexed && allDocs.length > 0) {
    const indexedRows = await db
      .selectDistinct({ id: documentChunks.documentId })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(eq(documents.userId, userId));
    const indexedSet = new Set(indexedRows.map((r) => r.id));
    const unindexed = allDocs.filter((d) => !indexedSet.has(d.id));
    skipped = allDocs.length - unindexed.length;
    docsToProcess = unindexed;
  }

  let indexed = 0;
  let failed = 0;
  let noKey = false;
  for (const d of docsToProcess) {
    const r = await reindexDocument(userId, d.id);
    if (r.ok) indexed += 1;
    else {
      failed += 1;
      if (r.reason === "no_mistral_key") noKey = true;
    }
  }
  revalidatePath("/documents");
  return { indexed, failed, noKey, skipped };
}

const folderNameSchema = z.string().trim().min(1).max(80);

export async function createFolder(
  name: string,
  parentFolderId: string | null
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const parsed = folderNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: "Nom invalide." };

  if (parentFolderId) {
    const [parent] = await db
      .select({ id: documentFolders.id })
      .from(documentFolders)
      .where(
        and(
          eq(documentFolders.id, parentFolderId),
          eq(documentFolders.userId, userId)
        )
      )
      .limit(1);
    if (!parent) return { ok: false, error: "Dossier parent introuvable." };
  }

  const [row] = await db
    .insert(documentFolders)
    .values({ userId, name: parsed.data, parentFolderId })
    .returning({ id: documentFolders.id });

  revalidatePath("/documents");
  return { ok: true, id: row.id };
}

export async function renameFolder(
  id: string,
  name: string
): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const parsed = folderNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false };
  await db
    .update(documentFolders)
    .set({ name: parsed.data })
    .where(
      and(eq(documentFolders.id, id), eq(documentFolders.userId, userId))
    );
  revalidatePath("/documents");
  return { ok: true };
}

/**
 * Supprime un dossier. ON DELETE CASCADE supprime aussi les sous-dossiers ;
 * les documents qu'il contenait passent à folderId = NULL (ON DELETE SET
 * NULL) — ils remontent à la racine, jamais perdus.
 */
export async function deleteFolder(id: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .delete(documentFolders)
    .where(
      and(eq(documentFolders.id, id), eq(documentFolders.userId, userId))
    );
  revalidatePath("/documents");
}

export async function moveDocumentToFolder(
  documentId: string,
  folderId: string | null
): Promise<{ ok: boolean }> {
  const userId = await requireUserId();

  if (folderId) {
    const [folder] = await db
      .select({ id: documentFolders.id })
      .from(documentFolders)
      .where(
        and(
          eq(documentFolders.id, folderId),
          eq(documentFolders.userId, userId)
        )
      )
      .limit(1);
    if (!folder) return { ok: false };
  }

  await db
    .update(documents)
    .set({ folderId })
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));

  revalidatePath("/documents");
  return { ok: true };
}

export type VersionDiffResult =
  | {
      ok: true;
      ops: DisplayOp[];
      truncated: boolean;
      older: { version: number; filename: string };
      newer: { version: number; filename: string };
    }
  | { ok: false; error: string };

/** Borne dure du payload de diff renvoyé (lignes affichables, contexte inclus). */
const MAX_DIFF_OPS = 4000;

/**
 * H19 — compare le texte extrait de deux versions d'un même document.
 * Sécurité : les deux ids doivent appartenir à l'utilisateur ET à la même
 * famille de versions (root = parentDocumentId ?? id). On replie les plages
 * inchangées et on plafonne le nombre de lignes renvoyées.
 */
export async function getDocumentVersionDiff(
  aId: string,
  bId: string
): Promise<VersionDiffResult> {
  const userId = await requireUserId();

  const rows = await db
    .select({
      id: documents.id,
      version: documents.version,
      filename: documents.filename,
      parentDocumentId: documents.parentDocumentId,
      extractedText: documents.extractedText,
      encDek: documents.encDek,
      encExtractedText: documents.encExtractedText,
      extractedTextNonce: documents.extractedTextNonce,
    })
    .from(documents)
    .where(and(inArray(documents.id, [aId, bId]), eq(documents.userId, userId)));

  const a = rows.find((r) => r.id === aId);
  const b = rows.find((r) => r.id === bId);
  if (!a || !b) return { ok: false, error: "Version introuvable." };

  const rootA = a.parentDocumentId ?? a.id;
  const rootB = b.parentDocumentId ?? b.id;
  if (rootA !== rootB) {
    return {
      ok: false,
      error: "Ces documents n'appartiennent pas à la même famille de versions.",
    };
  }

  const [aText, bText] = await Promise.all([
    decryptDocumentText(a),
    decryptDocumentText(b),
  ]);
  if (aText == null || bText == null) {
    return {
      ok: false,
      error:
        "Le texte d'au moins une version n'a pas pu être extrait — comparaison impossible.",
    };
  }

  // Toujours différ l'ancienne version vers la plus récente.
  const [older, newer] = a.version <= b.version ? [a, b] : [b, a];
  const oldText = a.version <= b.version ? aText : bText;
  const newText = a.version <= b.version ? bText : aText;

  const { ops, truncated: dpTruncated } = diffLines(oldText, newText);
  const collapsed = collapseDiff(ops);
  const truncated = dpTruncated || collapsed.length > MAX_DIFF_OPS;

  return {
    ok: true,
    ops: truncated ? collapsed.slice(0, MAX_DIFF_OPS) : collapsed,
    truncated,
    older: { version: older.version, filename: older.filename },
    newer: { version: newer.version, filename: newer.filename },
  };
}
