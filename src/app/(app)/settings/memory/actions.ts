"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { projectMemories } from "@/db/schema";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

/** Valide un fait : il pourra désormais influencer les réponses du dossier. */
export async function approveMemory(id: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .update(projectMemories)
    .set({ status: "approved" })
    .where(and(eq(projectMemories.id, id), eq(projectMemories.userId, userId)));
  revalidatePath("/settings/memory");
}

/** Repasse un fait validé en attente (le retire de l'influence). */
export async function unapproveMemory(id: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .update(projectMemories)
    .set({ status: "pending" })
    .where(and(eq(projectMemories.id, id), eq(projectMemories.userId, userId)));
  revalidatePath("/settings/memory");
}

export async function deleteMemory(id: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .delete(projectMemories)
    .where(and(eq(projectMemories.id, id), eq(projectMemories.userId, userId)));
  revalidatePath("/settings/memory");
}
