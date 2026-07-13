"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/permissions";
import { db } from "@/db";
import { agentRuns, conversations, messages } from "@/db/schema";

const titleSchema = z.string().trim().min(1).max(120);

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

  // Transaction : élagage + édition doivent être atomiques. Sans ça, un crash
  // entre le delete et l'update tronquerait l'historique tout en perdant
  // l'édition. On supprime aussi le trail d'audit des messages élagués
  // (agent_runs.messageId est ON DELETE SET NULL → suppression explicite).
  await db.transaction(async (tx) => {
    // Drop tout ce qui a été écrit après le message édité (réponses
    // assistant, tool calls, agent events…). Comparaison stricte sur
    // createdAt pour conserver le message lui-même.
    const removed = await tx
      .delete(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          gt(messages.createdAt, target.createdAt)
        )
      )
      .returning({ id: messages.id });
    if (removed.length > 0) {
      await tx.delete(agentRuns).where(
        inArray(
          agentRuns.messageId,
          removed.map((r) => r.id)
        )
      );
    }
    await tx
      .update(messages)
      .set({ content: parsed.data })
      .where(eq(messages.id, messageId));
    await tx
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  });

  revalidatePath("/chat");
  return { ok: true };
}

/**
 * Duplique une conversation dans une nouvelle (« fork »), à la manière de la
 * webui llama.cpp : on recopie les messages jusqu'à un point donné pour
 * repartir d'un endroit précis sans toucher au fil d'origine.
 *
 *  - `upToMessageId` : coupe juste après ce message (inclus). Précis quand la
 *    conv a été rechargée depuis la DB (vrais IDs). Pendant la session
 *    courante les IDs côté client viennent de l'AI SDK et ne matchent pas →
 *    on retombe alors sur `upToCount`.
 *  - `upToCount` : nombre de messages (depuis le début) à recopier. Fallback
 *    robuste, basé sur la position dans le fil.
 *  - sans option : fork complet de la conversation.
 *
 * Fork « léger » : seuls role + content (+ modelId) sont copiés. Les parts
 * (tool calls, reasoning), pièces jointes et compteurs de tokens ne sont pas
 * dupliqués — le texte reste, le contexte envoyé au LLM aussi. Projet, clé
 * provider et modèle de la conversation sont conservés pour rester dans le
 * même contexte de travail. Les `createdAt` d'origine sont préservés pour
 * garantir l'ordre du fil dans le fork.
 */
export async function forkConversation(
  sourceId: string,
  options?: { upToMessageId?: string; upToCount?: number }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const userId = await requireUserId();

  const [source] = await db
    .select({
      title: conversations.title,
      projectId: conversations.projectId,
      providerKeyId: conversations.providerKeyId,
      modelId: conversations.modelId,
    })
    .from(conversations)
    .where(
      and(eq(conversations.id, sourceId), eq(conversations.userId, userId))
    )
    .limit(1);
  if (!source) return { ok: false, error: "Conversation introuvable." };

  const all = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      modelId: messages.modelId,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, sourceId))
    .orderBy(asc(messages.createdAt));

  // Combien de messages recopier, depuis le début du fil.
  let cut = all.length;
  if (options?.upToMessageId) {
    const idx = all.findIndex((m) => m.id === options.upToMessageId);
    if (idx >= 0) cut = idx + 1;
    else if (typeof options.upToCount === "number") cut = options.upToCount;
  } else if (typeof options?.upToCount === "number") {
    cut = options.upToCount;
  }
  cut = Math.max(0, Math.min(cut, all.length));
  const slice = all.slice(0, cut);

  const baseTitle = source.title.slice(0, 112).trim();
  const title = `${baseTitle || "Conversation"} (fork)`;

  const newId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(conversations)
      .values({
        userId,
        projectId: source.projectId,
        providerKeyId: source.providerKeyId,
        modelId: source.modelId,
        title,
      })
      .returning({ id: conversations.id });

    if (slice.length > 0) {
      await tx.insert(messages).values(
        slice.map((m) => ({
          conversationId: created.id,
          role: m.role,
          content: m.content,
          modelId: m.modelId,
          createdAt: m.createdAt,
        }))
      );
    }
    return created.id;
  });

  revalidatePath("/chat");
  return { ok: true, id: newId };
}

export type AuditRunView = {
  messageId: string | null;
  role: string;
  label: string;
  modelId: string | null;
  providerType: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  status: string;
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
};

/**
 * H3b : trail d'audit multi-agents d'une conversation, groupé par message
 * assistant (agent_runs.messageId, rattaché côté route — P1/H9). Vérifie la
 * propriété de la conversation. Sert à l'affichage et à l'export (H5).
 */
async function getConversationAuditTrail(
  conversationId: string
): Promise<AuditRunView[] | null> {
  const userId = await requireUserId();
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
  if (!conv) return null;

  const runs = await db
    .select({
      messageId: agentRuns.messageId,
      role: agentRuns.role,
      label: agentRuns.label,
      modelId: agentRuns.modelId,
      providerType: agentRuns.providerType,
      inputTokens: agentRuns.inputTokens,
      outputTokens: agentRuns.outputTokens,
      latencyMs: agentRuns.latencyMs,
      status: agentRuns.status,
      error: agentRuns.error,
      startedAt: agentRuns.startedAt,
      finishedAt: agentRuns.finishedAt,
    })
    .from(agentRuns)
    .where(eq(agentRuns.conversationId, conversationId))
    .orderBy(asc(agentRuns.startedAt));

  return runs;
}

/**
 * H5 : export du trail d'audit en JSON, groupé par message. Livrable
 * « auditable / opposable » : qui (agents, rôles, modèles) a produit quoi,
 * à quel coût (tokens) et latence, avec les erreurs éventuelles.
 */
export async function exportConversationAuditJson(
  conversationId: string
): Promise<{ ok: true; json: string; filename: string } | { ok: false }> {
  const userId = await requireUserId();
  const [conv] = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId)
      )
    )
    .limit(1);
  if (!conv) return { ok: false };

  const runs = await getConversationAuditTrail(conversationId);
  if (!runs) return { ok: false };

  const byMessage = new Map<string, AuditRunView[]>();
  for (const r of runs) {
    const key = r.messageId ?? "(non rattaché)";
    const list = byMessage.get(key) ?? [];
    list.push(r);
    byMessage.set(key, list);
  }

  const payload = {
    conversation: {
      id: conv.id,
      title: conv.title,
      createdAt: new Date(conv.createdAt).toISOString(),
      exportedAt: new Date().toISOString(),
    },
    messages: Array.from(byMessage.entries()).map(([messageId, agents]) => ({
      messageId,
      agents: agents.map((a) => ({
        role: a.role,
        label: a.label,
        modelId: a.modelId,
        providerType: a.providerType,
        inputTokens: a.inputTokens,
        outputTokens: a.outputTokens,
        latencyMs: a.latencyMs,
        status: a.status,
        error: a.error,
        startedAt: a.startedAt ? new Date(a.startedAt).toISOString() : null,
        finishedAt: a.finishedAt ? new Date(a.finishedAt).toISOString() : null,
      })),
    })),
  };

  const safeName = conv.title
    .replace(/[^a-zA-Z0-9_\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .trim();
  return {
    ok: true,
    json: JSON.stringify(payload, null, 2),
    filename: `${safeName || "conversation"}-audit.json`,
  };
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
