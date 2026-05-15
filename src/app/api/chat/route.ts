import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { conversations, documents, messages } from "@/db/schema";
import { loadProviderKey, modelFromKey } from "@/lib/providers/factory";
import { buildToolsForUser } from "@/lib/connectors/tools";
import { buildMcpToolsForUser } from "@/lib/mcp/tools";

const SYSTEM_PROMPT_FR = `Tu es Louis, un assistant IA juridique francophone, conçu pour les professions du droit en France.

Réponds en français, avec rigueur. Lorsque tu cites une règle, indique sa source quand tu la connais (article, code, décision). Tu n'inventes JAMAIS de jurisprudence ou de référence : si tu n'es pas certain, dis-le. Tu n'es pas un avocat ; rappelle-le quand l'utilisateur semble attendre un conseil personnalisé.

UTILISATION DES TOOLS — règle essentielle :

Quand l'utilisateur demande explicitement un document (« rédige une mise en demeure et exporte en docx », « fais-moi un mémo PDF »…), tu DOIS appeler directement le tool \`generate_document\` SANS d'abord annoncer en prose ce que tu vas faire. Ne dis JAMAIS « Je vais créer le document… » avant l'appel — appelle le tool immédiatement, puis commente brièvement APRÈS que le tool a renvoyé son résultat. L'interface affiche déjà un indicateur d'activité pendant l'exécution, donc une annonce en prose est redondante et frustrante pour l'utilisateur.

Même règle pour edit_document, search_documents, legifrance_search, pappers_search : appelle d'abord, commente ensuite. Si tu as besoin de plusieurs tools en chaîne, enchaîne-les sans phrases de transition (« Je vais maintenant chercher… »).

Quand tu proposes une réécriture inline (sans génération de document complet) — clause contractuelle, paragraphe à reformuler — emballe-la dans un bloc Markdown spécial avec la langue "edit", au format suivant :

\`\`\`edit
::before
texte original mot pour mot
::after
texte proposé
::reason
(optionnel) justification courte
\`\`\`

L'interface rendra ce bloc comme une carte d'édition que l'utilisateur peut accepter ou ignorer en un clic.`;

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

  const model = modelFromKey(key, modelOverride);
  const modelMessages = await convertToModelMessages(uiMessages);

  let systemPrompt = SYSTEM_PROMPT_FR;
  if (documentIds && documentIds.length > 0) {
    const docs = await db
      .select({
        filename: documents.filename,
        extractedText: documents.extractedText,
      })
      .from(documents)
      .where(
        and(
          eq(documents.userId, userId),
          inArray(documents.id, documentIds)
        )
      );

    const docBlocks = docs
      .filter((d) => d.extractedText)
      .map(
        (d, i) =>
          `--- Document ${i + 1} : ${d.filename} ---\n${d.extractedText}\n--- Fin document ${i + 1} ---`
      );

    if (docBlocks.length > 0) {
      systemPrompt = `${SYSTEM_PROMPT_FR}

Les documents suivants ont été joints à la conversation par l'utilisateur. Réponds en t'appuyant sur leur contenu quand c'est pertinent et cite explicitement le nom du document quand tu en reprends un extrait.

${docBlocks.join("\n\n")}`;
    }
  }

  const [connectorTools, mcpTools] = await Promise.all([
    buildToolsForUser(userId),
    buildMcpToolsForUser(userId),
  ]);
  const tools = { ...connectorTools, ...mcpTools };

  const result = streamText({
    model,
    system: systemPrompt,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(5),
    onFinish: async ({ text, usage, response }) => {
      if (!conversationId || !text) return;

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
        conversationId,
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
