"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents, documentFolders } from "@/db/schema";
import { deleteObject } from "@/lib/storage";
import { recordAudit } from "@/lib/audit";
import { reindexDocument, type ReindexResult } from "@/lib/rag/index-document";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

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

/** R6 : réindexe tous les documents de l'utilisateur (utile après avoir
 * ajouté sa clé Mistral suite à des imports non indexés). */
export async function reindexAllDocumentsAction(): Promise<{
  indexed: number;
  failed: number;
  noKey: boolean;
}> {
  const userId = await requireUserId();
  const docs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(eq(documents.userId, userId), isNotNull(documents.extractedText))
    );
  let indexed = 0;
  let failed = 0;
  let noKey = false;
  for (const d of docs) {
    const r = await reindexDocument(userId, d.id);
    if (r.ok) indexed += 1;
    else {
      failed += 1;
      if (r.reason === "no_mistral_key") noKey = true;
    }
  }
  revalidatePath("/documents");
  return { indexed, failed, noKey };
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
