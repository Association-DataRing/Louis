import { type UIMessage } from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { conversations, documents, messages } from "@/db/schema";
import { loadProviderKey } from "@/lib/providers/factory";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { Orchestrator, chatSimplePipeline } from "@/lib/orchestrator";

type Body = {
  messages: UIMessage[];
  providerKeyId: string;
  conversationId?: string | null;
  modelOverride?: string | null;
  documentIds?: string[];
  projectId?: string | null;
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  // Rate-limit par utilisateur authentifié — protège contre une boucle
  // accidentelle côté client ou un user qui voudrait faire exploser ses
  // coûts provider intentionnellement / par script.
  const rl = await rateLimit("chat", userId);
  if (!rl.allowed) return tooManyRequests(rl);

  const body = (await req.json()) as Body;
  const {
    messages: uiMessages,
    providerKeyId,
    modelOverride,
    documentIds,
    projectId: projectIdFromBody,
  } = body;
  let conversationId = body.conversationId ?? null;

  if (!providerKeyId) {
    return new Response("providerKeyId is required", { status: 400 });
  }

  try {
    await loadProviderKey(userId, providerKeyId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Provider error";
    return new Response(msg, { status: 400 });
  }

  if (!conversationId) {
    const firstUser = uiMessages.find((m) => m.role === "user");
    const title = extractTextPreview(firstUser) || "Nouvelle conversation";
    const [created] = await db
      .insert(conversations)
      .values({
        userId,
        providerKeyId,
        projectId: projectIdFromBody ?? null,
        modelId: modelOverride ?? null,
        title: title.slice(0, 80),
      })
      .returning({ id: conversations.id });
    conversationId = created.id;
  }

  const lastUser = uiMessages.at(-1);
  if (lastUser?.role === "user") {
    const text = extractTextPreview(lastUser);
    if (text) {
      await db.insert(messages).values({
        conversationId,
        role: "user",
        content: text,
      });
    }
  }

  // Charge les pièces jointes éventuelles et les injecte comme rallonge du
  // system prompt. L'Orchestrator/Agent reste agnostique : il ne sait pas
  // qu'il s'agit de documents, il reçoit simplement du contexte additionnel.
  let systemPromptExtras: string | undefined;
  if (documentIds && documentIds.length > 0) {
    const docs = await db
      .select({
        filename: documents.filename,
        extractedText: documents.extractedText,
      })
      .from(documents)
      .where(
        and(eq(documents.userId, userId), inArray(documents.id, documentIds))
      );

    const docBlocks = docs
      .filter((d) => d.extractedText)
      .map(
        (d, i) =>
          `--- Document ${i + 1} : ${d.filename} ---\n${d.extractedText}\n--- Fin document ${i + 1} ---`
      );

    if (docBlocks.length > 0) {
      systemPromptExtras = `Les documents suivants ont été joints à la conversation par l'utilisateur. Réponds en t'appuyant sur leur contenu quand c'est pertinent et cite explicitement le nom du document quand tu en reprends un extrait.\n\n${docBlocks.join("\n\n")}`;
    }
  }

  const orchestrator = new Orchestrator(
    chatSimplePipeline({ providerKeyId, modelOverride })
  );

  const finalConversationId = conversationId;

  const { stream } = await orchestrator.run({
    userId,
    conversationId: finalConversationId,
    messages: uiMessages,
    documentIds,
    systemPromptExtras,
    onFinish: async ({ text, usage, response }) => {
      if (!finalConversationId || !text) return;

      // Extrait les parts brutes des messages assistants — texte +
      // tool-calls + tool-results en format normalisé pour re-render
      // les pills cliquables au reload de la conversation.
      type SavedPart =
        | { type: "text"; text: string }
        | {
            type: "tool-call";
            toolCallId: string;
            toolName: string;
            input: unknown;
          }
        | {
            type: "tool-result";
            toolCallId: string;
            toolName: string;
            output: unknown;
          };

      const savedParts: SavedPart[] = [];
      for (const m of response.messages) {
        if (m.role !== "assistant" && m.role !== "tool") continue;
        const content = m.content;
        if (typeof content === "string") continue;
        for (const c of content) {
          if (c.type === "text" && c.text) {
            savedParts.push({ type: "text", text: c.text });
          } else if (c.type === "tool-call") {
            savedParts.push({
              type: "tool-call",
              toolCallId: c.toolCallId,
              toolName: c.toolName,
              input: c.input,
            });
          } else if (c.type === "tool-result") {
            savedParts.push({
              type: "tool-result",
              toolCallId: c.toolCallId,
              toolName: c.toolName,
              output: c.output,
            });
          }
        }
      }

      await db.insert(messages).values({
        conversationId: finalConversationId,
        role: "assistant",
        content: text,
        parts: savedParts.length > 0 ? savedParts : null,
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
        modelId: modelOverride ?? null,
      });
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, finalConversationId));
    },
  });

  return stream.toUIMessageStreamResponse({
    headers: {
      "x-conversation-id": finalConversationId,
    },
    messageMetadata: ({ part }) => {
      if (part.type === "start") {
        return { conversationId: finalConversationId };
      }
      if (part.type === "finish") {
        return {
          usage: {
            inputTokens: part.totalUsage?.inputTokens ?? 0,
            outputTokens: part.totalUsage?.outputTokens ?? 0,
          },
        };
      }
    },
  });
}

function extractTextPreview(msg: UIMessage | undefined): string {
  if (!msg) return "";
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
}
