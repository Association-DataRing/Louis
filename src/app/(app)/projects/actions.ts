"use server";

import type { ActionResult as BaseActionResult } from "@/lib/actions/result";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/permissions";
import { db } from "@/db";
import {
  projects,
  conversations,
  documents,
  documentFolders,
} from "@/db/schema";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
});

export type ActionResult = BaseActionResult<{ id?: string }>;

export async function createProject(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
  });

  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return {
      ok: false,
      error:
        field === "description"
          ? "La description ne peut pas dépasser 500 caractères."
          : "Le nom du projet est requis (80 caractères max).",
    };
  }

  // Emplacement de stockage : soit un dossier existant (vérifié), soit un
  // nouveau dossier créé à la racine. À défaut on crée un dossier au nom du
  // projet — un projet a toujours un dossier-racine (modèle dossier = projet).
  const folderMode = formData.get("folderMode");
  let folderId: string | null = null;

  if (folderMode === "existing") {
    const existingRaw = formData.get("folderId");
    if (typeof existingRaw === "string" && existingRaw.length > 0) {
      const [folder] = await db
        .select({ id: documentFolders.id })
        .from(documentFolders)
        .where(
          and(
            eq(documentFolders.id, existingRaw),
            eq(documentFolders.userId, userId)
          )
        )
        .limit(1);
      if (!folder) {
        return { ok: false, error: "Dossier de stockage introuvable." };
      }
      folderId = folder.id;
    }
  }

  // Transaction : création du dossier-racine (si besoin) + du projet de manière
  // atomique — sinon un échec après l'insert du dossier laisse un dossier
  // orphelin sans projet.
  const newId = await db.transaction(async (tx) => {
    let resolvedFolderId = folderId;
    if (!resolvedFolderId) {
      const nameRaw = formData.get("folderName");
      const folderName =
        (typeof nameRaw === "string" && nameRaw.trim()) || parsed.data.name;
      const [folder] = await tx
        .insert(documentFolders)
        .values({ userId, name: folderName.slice(0, 80), parentFolderId: null })
        .returning({ id: documentFolders.id });
      resolvedFolderId = folder.id;
    }
    const [row] = await tx
      .insert(projects)
      .values({
        userId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        folderId: resolvedFolderId,
      })
      .returning({ id: projects.id });
    return row.id;
  });

  revalidatePath("/projects");
  revalidatePath("/documents");
  revalidatePath("/chat");
  return { ok: true, id: newId };
}

export async function updateProject(
  id: string,
  name: string,
  description: string | null
): Promise<void> {
  const userId = await requireUserId();
  const trimmed = name.trim();
  if (!trimmed) return;
  await db
    .update(projects)
    .set({
      name: trimmed.slice(0, 80),
      description: description?.trim().slice(0, 500) || null,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}

export async function deleteProject(id: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));
  revalidatePath("/projects");
  revalidatePath("/chat");
  redirect("/projects");
}

export async function moveConversationToProject(
  conversationId: string,
  projectId: string | null
): Promise<void> {
  const userId = await requireUserId();
  await db
    .update(conversations)
    .set({ projectId, updatedAt: new Date() })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId)
      )
    );
  revalidatePath("/chat");
  revalidatePath("/projects");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function moveDocumentToProject(
  documentId: string,
  projectId: string | null
): Promise<void> {
  const userId = await requireUserId();

  // H18 : le périmètre RAG d'un projet est défini par son DOSSIER
  // (lib/projects/scope ignore projectId). On déplace donc RÉELLEMENT le
  // document dans le dossier du projet — sinon le badge « projet » mentirait
  // (le doc ne serait pas vu par search_documents en contexte projet).
  // projectId reste écrit (miroir d'affichage du badge). En retirant d'un
  // projet (projectId=null), on remonte le doc à la racine.
  let folderId: string | null = null;
  if (projectId) {
    const [proj] = await db
      .select({ folderId: projects.folderId })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);
    if (!proj) return; // projet introuvable / pas le propriétaire → no-op
    folderId = proj.folderId;
  }

  await db
    .update(documents)
    .set({ projectId, folderId })
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
  revalidatePath("/documents");
  revalidatePath("/projects");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}
