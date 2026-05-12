"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { conversations } from "@/db/schema";

const titleSchema = z.string().trim().min(1).max(120);

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function renameConversation(
  id: string,
  title: string
): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const parsed = titleSchema.safeParse(title);
  if (!parsed.success) return { ok: false };

  await db
    .update(conversations)
    .set({ title: parsed.data, updatedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));

  revalidatePath("/chat");
  return { ok: true };
}

export async function deleteConversation(
  id: string,
  options?: { redirectToFresh?: boolean }
): Promise<void> {
  const userId = await requireUserId();

  await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));

  revalidatePath("/chat");
  if (options?.redirectToFresh) redirect("/chat");
}
