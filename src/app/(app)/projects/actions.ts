"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { projects, conversations, documents } from "@/db/schema";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
});

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createProject(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
  });

  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const [row] = await db
    .insert(projects)
    .values({
      userId,
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .returning({ id: projects.id });

  revalidatePath("/projects");
  revalidatePath("/chat");
  return { ok: true, id: row.id };
}

export async function renameProject(id: string, name: string): Promise<void> {
  const userId = await requireUserId();
  const trimmed = name.trim();
  if (!trimmed) return;
  await db
    .update(projects)
    .set({ name: trimmed, updatedAt: new Date() })
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
  await db
    .update(documents)
    .set({ projectId })
    .where(
      and(eq(documents.id, documentId), eq(documents.userId, userId))
    );
  revalidatePath("/documents");
  revalidatePath("/projects");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}
