"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, gt } from "drizzle-orm";
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

const editContentSchema = z.string().trim().min(1).max(10_000);

/**
 * Édite le contenu d'un message utilisateur ET supprime tous les messages
 * postérieurs dans la même conversation. Sert au pattern « edit & retry »
 * — l'utilisateur ajuste sa question, la suite est élaguée, le client
 * relance ensuite une régénération via `regenerate({...})` sur useChat.
 *
 * Vérifie : (1) ownership de la conversation, (2) le message appartient
 * bien à la conv et a le rôle "user".
 */
export async function editUserMessageAndTrim(
  conversationId: string,
  messageId: string,
  newContent: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const parsed = editContentSchema.safeParse(newContent);
  if (!parsed.success) {
    return { ok: false, error: "Contenu invalide (1–10 000 caractères)." };
  }

  const [conv] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId)
      )
    )
    .limit(1);
  if (!conv) return { ok: false, error: "Conversation introuvable." };

  const [target] = await db
    .select({
      id: messages.id,
      role: messages.role,
      createdAt: messages.createdAt,
      conversationId: messages.conversationId,
    })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  if (!target || target.conversationId !== conversationId) {
    return { ok: false, error: "Message introuvable." };
  }
  if (target.role !== "user") {
    return { ok: false, error: "Seuls les messages utilisateur sont éditables." };
  }

  // Drop tout ce qui a été écrit après le message édité (réponses
  // assistant, tool calls, agent events…). Comparaison stricte sur
  // createdAt pour conserver le message lui-même.
  await db
    .delete(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        gt(messages.createdAt, target.createdAt)
      )
    );

  await db
    .update(messages)
    .set({ content: parsed.data })
    .where(eq(messages.id, messageId));

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  revalidatePath("/chat");
  return { ok: true };
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
