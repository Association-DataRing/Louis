import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  agentRuns,
  conversations,
  documents,
  messages,
  type SavedPart,
} from "@/db/schema";
import { loadProviderKey } from "@/lib/providers/factory";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  Orchestrator,
  chatSimplePipeline,
  type OrchestratorEvent,
} from "@/lib/orchestrator";
import { loadPipelineForUser } from "@/lib/orchestrator/repository";

type Body = {
  messages: UIMessage[];
  providerKeyId: string;
  conversationId?: string | null;
  modelOverride?: string | null;
  documentIds?: string[];
  projectId?: string | null;
  /** Pipeline orchestrateur à utiliser. null/undefined → chat-simple. */
  pipelineId?: string | null;
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  const rl = await rateLimit("chat", userId);
  if (!rl.allowed) return tooManyRequests(rl);

  const body = (await req.json()) as Body;
  const {
    messages: uiMessages,
    providerKeyId,
    modelOverride,
    documentIds,
    projectId: projectIdFromBody,
    pipelineId,
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

  // Résout la pipeline : soit celle pointée par pipelineId (et l'on vérifie
  // qu'elle appartient bien à l'utilisateur), soit le preset mono-agent
  // chat-simple par défaut.
  const pipelineConfig = pipelineId
    ? await loadPipelineForUser(userId, pipelineId, {
        providerKeyId,
        modelOverride,
      })
    : chatSimplePipeline({ providerKeyId, modelOverride });

  if (!pipelineConfig) {
    return new Response("Pipeline introuvable", { status: 404 });
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

  const finalConversationId = conversationId;

  const lastUser = uiMessages.at(-1);
  if (lastUser?.role === "user") {
    const text = extractTextPreview(lastUser);
    if (text) {
      await db.insert(messages).values({
        conversationId: finalConversationId,
        role: "user",
        content: text,
      });
    }
  }

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

  // États mutables capturés par les callbacks de streamText (savedParts du
  // message final pour ré-hydrater les tool calls au reload) et par
  // onEvent (audit trail multi-agent dans agent_runs).
  const savedParts: SavedPart[] = [];
  let finalText = "";
  let finalUsage: { inputTokens?: number; outputTokens?: number } = {};
  const agentStarts = new Map<string, number>();

  const orchestrator = new Orchestrator(pipelineConfig);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      await orchestrator.run({
        ctx: {
          userId,
          conversationId: finalConversationId,
          messages: uiMessages,
          documentIds,
          systemPromptExtras,
        },
        writer: {
          write: (part) => writer.write(part as never),
          merge: (s) => writer.merge(s as never),
        },
        onEvent: async (event: OrchestratorEvent) => {
          if (event.type === "agent_start") {
            agentStarts.set(event.agentId, Date.now());
            return;
          }

          if (event.type === "agent_finish") {
            const startedAt = agentStarts.get(event.agentId) ?? Date.now();
            const startedDate = new Date(startedAt);
            await db.insert(agentRuns).values({
              conversationId: finalConversationId,
              pipelineId: pipelineConfig.id ?? null,
              pipelineAgentId: isUuid(event.agentId) ? event.agentId : null,
              role: event.role,
              label: event.label,
              modelId: modelOverride ?? null,
              providerType: null,
              status: "success",
              inputTokens: event.inputTokens ?? null,
              outputTokens: event.outputTokens ?? null,
              latencyMs: event.latencyMs,
              output: event.preview ?? null,
              startedAt: startedDate,
              finishedAt: new Date(),
            });
            return;
          }

          if (event.type === "agent_error") {
            const startedAt = agentStarts.get(event.agentId) ?? Date.now();
            await db.insert(agentRuns).values({
              conversationId: finalConversationId,
              pipelineId: pipelineConfig.id ?? null,
              pipelineAgentId: isUuid(event.agentId) ? event.agentId : null,
              role: event.role,
              label: event.label,
              modelId: modelOverride ?? null,
              status: "error",
              latencyMs: Date.now() - startedAt,
              error: event.error,
              startedAt: new Date(startedAt),
              finishedAt: new Date(),
            });
          }
        },
      });
    },
    onFinish: async ({ messages: streamMessages }) => {
      // Reconstitue les parts brutes du dernier message assistant (le
      // texte final + les tool calls/results) pour les re-render au load.
      for (const m of streamMessages) {
        if (m.role !== "assistant") continue;
        for (const part of m.parts) {
          if (part.type === "text" && part.text) {
            savedParts.push({ type: "text", text: part.text });
            finalText += part.text;
          } else if (
            part.type.startsWith("tool-") &&
            "toolCallId" in part &&
            "state" in part
          ) {
            const toolPart = part as {
              type: string;
              toolCallId: string;
              state: string;
              input?: unknown;
              output?: unknown;
            };
            const toolName = toolPart.type.replace(/^tool-/, "");
            if (toolPart.state === "input-available" && "input" in toolPart) {
              savedParts.push({
                type: "tool-call",
                toolCallId: toolPart.toolCallId,
                toolName,
                input: toolPart.input,
              });
            }
            if (
              (toolPart.state === "output-available" ||
                toolPart.state === "output-error") &&
              "output" in toolPart
            ) {
              savedParts.push({
                type: "tool-result",
                toolCallId: toolPart.toolCallId,
                toolName,
                output: toolPart.output,
              });
            }
          }
        }
      }

      if (!finalText) return;

      await db.insert(messages).values({
        conversationId: finalConversationId,
        role: "assistant",
        content: finalText,
        parts: savedParts.length > 0 ? savedParts : null,
        inputTokens: finalUsage.inputTokens ?? null,
        outputTokens: finalUsage.outputTokens ?? null,
        modelId: modelOverride ?? null,
      });
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, finalConversationId));
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      "x-conversation-id": finalConversationId,
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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}
