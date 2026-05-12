import {
  streamText,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { loadProviderKey, modelFromKey } from "@/lib/providers/factory";

const SYSTEM_PROMPT_FR = `Tu es Louis, un assistant IA juridique francophone, conçu pour les professions du droit en France.

Réponds en français, avec rigueur. Lorsque tu cites une règle, indique sa source quand tu la connais (article, code, décision). Tu n'inventes JAMAIS de jurisprudence ou de référence : si tu n'es pas certain, dis-le. Tu n'es pas un avocat ; rappelle-le quand l'utilisateur semble attendre un conseil personnalisé.`;

type Body = {
  messages: UIMessage[];
  providerKeyId: string;
  conversationId?: string | null;
  modelOverride?: string | null;
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json()) as Body;
  const { messages: uiMessages, providerKeyId, modelOverride } = body;
  let conversationId = body.conversationId ?? null;

  if (!providerKeyId) {
    return new Response("providerKeyId is required", { status: 400 });
  }

  let key;
  try {
    key = await loadProviderKey(userId, providerKeyId);
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

  const model = modelFromKey(key, modelOverride);
  const modelMessages = await convertToModelMessages(uiMessages);

  const result = streamText({
    model,
    system: SYSTEM_PROMPT_FR,
    messages: modelMessages,
    onFinish: async ({ text }) => {
      if (!conversationId || !text) return;
      await db.insert(messages).values({
        conversationId,
        role: "assistant",
        content: text,
      });
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
    },
  });

  const finalConversationId = conversationId;
  return result.toUIMessageStreamResponse({
    headers: {
      "x-conversation-id": finalConversationId,
    },
    messageMetadata: ({ part }) => {
      if (part.type === "start") {
        return { conversationId: finalConversationId };
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
