"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";

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

export async function togglePinConversation(id: string): Promise<void> {
  const userId = await requireUserId();
  const [current] = await db
    .select({ pinnedAt: conversations.pinnedAt })
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);
  if (!current) return;
  await db
    .update(conversations)
    .set({ pinnedAt: current.pinnedAt ? null : new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  revalidatePath("/chat");
}

export async function exportConversationMarkdown(
  id: string
): Promise<{ ok: true; markdown: string; filename: string } | { ok: false }> {
  const userId = await requireUserId();

  const [conv] = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);
  if (!conv) return { ok: false };

  const rows = await db
    .select({
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  const dateStr = new Date(conv.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const lines: string[] = [
    `# ${conv.title}`,
    "",
    `_Conversation Louis · créée le ${dateStr}_`,
    "",
    "---",
    "",
  ];
  for (const r of rows) {
    const label = r.role === "user" ? "**Vous**" : "**Louis**";
    lines.push(`### ${label}`);
    lines.push("");
    lines.push(r.content);
    lines.push("");
  }

  const safeName = conv.title
    .replace(/[^a-zA-Z0-9_\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .trim();
  const filename = `${safeName || "conversation"}.md`;

  return { ok: true, markdown: lines.join("\n"), filename };
}
