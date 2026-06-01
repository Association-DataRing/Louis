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
import { loadProviderKey, modelFromKey } from "@/lib/providers/factory";
import { getProjectScope } from "@/lib/projects/scope";
import { indexMessageForProject } from "@/lib/rag/message-search";
import {
  getMonthlySpendCents,
  getUserMonthlyQuotaCents,
} from "@/lib/usage/quota";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getEnabledSkills } from "@/app/(app)/settings/skills/actions";
import {
  composeSkillsPrompt,
  detectRelevantSkills,
} from "@/lib/skills/detector";
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

  // Enforcement du quota mensuel admin. Si le user a un plafond défini, on
  // calcule sa dépense IA du mois via le helper PARTAGÉ avec l'affichage
  // (page usage, dashboard) — même formule, donc le montant montré au membre
  // == celui qui déclenche ce blocage 402.
  const quotaCents = await getUserMonthlyQuotaCents(userId);
  if (quotaCents != null) {
    const spentCents = await getMonthlySpendCents(userId);
    if (spentCents >= quotaCents) {
      return new Response(
        JSON.stringify({
          error: "quota_exceeded",
          spentCents,
          quotaCents,
          message:
            "Quota mensuel atteint. Contactez l'administrateur de votre cabinet pour le relever ou attendez le mois suivant.",
        }),
        {
          status: 402,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

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

  // Type du provider de la conversation — stampé sur chaque agent_run pour
  // que l'audit trail soit lisible (et exportable) sans re-résoudre la clé.
  let providerType: string | null = null;
  try {
    const pk = await loadProviderKey(userId, providerKeyId);
    providerType = pk.type;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Provider error";
    return new Response(msg, { status: 400 });
  }

  // Verify ownership of existing conversation to prevent cross-user injection.
  // On récupère aussi son projectId : pour une conversation existante le body
  // ne porte pas forcément le projet (chat-shell ne le transmet que pour les
  // nouvelles), donc la conversation est la source de vérité du périmètre.
  let effectiveProjectId: string | null = null;
  if (conversationId) {
    const [conv] = await db
      .select({ id: conversations.id, projectId: conversations.projectId })
      .from(conversations)
      .where(
        and(eq(conversations.id, conversationId), eq(conversations.userId, userId))
      )
      .limit(1);
    if (!conv) {
      return new Response("Conversation not found", { status: 404 });
    }
    effectiveProjectId = conv.projectId;
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
    effectiveProjectId = projectIdFromBody ?? null;
  }

  const finalConversationId = conversationId;

  // Périmètre projet (modèle dossier = projet) : documents du sous-arbre du
  // dossier-racine + dossier de destination des documents générés. Sert au
  // scoping RAG des outils documentaires et à l'historique des conversations.
  const projectScope = effectiveProjectId
    ? await getProjectScope(userId, effectiveProjectId)
    : null;

  let userMessageId: string | null = null;
  let userMessageText = "";
  const lastUser = uiMessages.at(-1);
  if (lastUser?.role === "user") {
    const text = extractTextPreview(lastUser);
    if (text) {
      userMessageText = text;
      const [insertedUser] = await db
        .insert(messages)
        .values({
          conversationId: finalConversationId,
          role: "user",
          content: text,
          // Trace des documents joints à CE tour, pour ré-afficher les pills
          // au re-load. Le contenu des docs est injecté dans le system prompt
          // plus bas — ici on garde juste la liste d'IDs pour l'UI.
          metadata:
            documentIds && documentIds.length > 0
              ? { documentIds }
              : null,
        })
        .returning({ id: messages.id });
      userMessageId = insertedUser.id;
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

  // ─── Détection automatique de skills ────────────────────────────────
  // Avant de lancer l'orchestrateur, on demande à un classificateur
  // léger quelles skills (parmi celles activées par l'utilisateur) sont
  // pertinentes pour la demande. Leurs system prompts sont alors empilés
  // dans systemPromptExtras → injectés dans le prompt système du
  // modèle principal. L'utilisateur n'a rien à toggle manuellement.
  let detectedSkillSlugs: string[] = [];
  try {
    const lastUserText = extractTextPreview(lastUser);
    if (lastUserText) {
      const userSkills = await getEnabledSkills(userId);
      if (userSkills.length > 0) {
        // Modèle classificateur = même clé que la conversation. AI SDK
        // gère le streaming pour la réponse principale ; ici on fait
        // juste un generateObject one-shot.
        const detectorModel = modelFromKey(
          await loadProviderKey(userId, providerKeyId),
          modelOverride ?? null
        );
        detectedSkillSlugs = await detectRelevantSkills({
          model: detectorModel,
          userMessage: lastUserText,
          candidateSkills: userSkills,
        });
        if (detectedSkillSlugs.length > 0) {
          const selected = userSkills.filter((s) =>
            detectedSkillSlugs.includes(s.slug)
          );
          const skillsBlock = composeSkillsPrompt(selected);
          if (skillsBlock) {
            systemPromptExtras = systemPromptExtras
              ? `${systemPromptExtras}\n\n---\n\n${skillsBlock}`
              : skillsBlock;
          }
        }
      }
    }
  } catch {
    // Best-effort : si la détection plante (capacity, timeout…), on
    // continue sans skills plutôt que de bloquer la conversation.
  }

  // États mutables capturés par les callbacks de streamText (savedParts du
  // message final pour ré-hydrater les tool calls au reload) et par
  // onEvent (audit trail multi-agent dans agent_runs).
  const savedParts: SavedPart[] = [];
  let finalText = "";
  const finalUsage: { inputTokens?: number; outputTokens?: number } = {};
  const agentStarts = new Map<string, number>();
  // Audit trail multi-agent accumulé pendant le run, inséré en batch dans
  // onFinish une fois l'id du message assistant connu (rattachement messageId).
  // Accumuler (vs insert immédiat) évite aussi de laisser des runs orphelins
  // quand un Stop annule le tour avant l'insertion du message.
  const pendingRuns: (typeof agentRuns.$inferInsert)[] = [];

  const orchestrator = new Orchestrator(pipelineConfig);

  // Skills détectées qu'on émet dans le stream pour que la live panel
  // puisse afficher "Skill X activée" — visible côté utilisateur.
  const detectedSkillsForUI = detectedSkillSlugs;

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Émet la liste des skills détectées en tout début de stream pour
      // que la live panel les affiche immédiatement.
      if (detectedSkillsForUI.length > 0) {
        writer.write({
          type: "data-skills-detected",
          data: { slugs: detectedSkillsForUI },
        });
      }
      await orchestrator.run({
        ctx: {
          userId,
          conversationId: finalConversationId,
          messages: uiMessages,
          documentIds,
          systemPromptExtras,
          projectId: effectiveProjectId,
          projectDocumentIds: projectScope?.documentIds,
          projectFolderId: projectScope?.folderId ?? null,
          // R2 : annulation réelle côté serveur. Quand l'utilisateur clique
          // « Stop », DefaultChatTransport abort le fetch → req.signal s'abort
          // → propagé jusqu'à streamText, qui coupe l'appel LLM (et la
          // facturation), pas seulement le rendu client.
          abortSignal: req.signal,
        },
        writer: {
          write: (part) => writer.write(part as never),
          merge: (s) => writer.merge(s as never),
        },
        onEvent: (event: OrchestratorEvent) => {
          if (event.type === "agent_start") {
            agentStarts.set(event.agentId, Date.now());
            return;
          }

          if (event.type === "agent_finish") {
            // R1 : usage agrégé du run = somme de TOUS les agents. Le message
            // porte le coût total (pill, page usage, quota) ; le détail par
            // agent vit dans agent_runs (audit trail).
            finalUsage.inputTokens =
              (finalUsage.inputTokens ?? 0) + (event.inputTokens ?? 0);
            finalUsage.outputTokens =
              (finalUsage.outputTokens ?? 0) + (event.outputTokens ?? 0);

            const startedAt = agentStarts.get(event.agentId) ?? Date.now();
            pendingRuns.push({
              conversationId: finalConversationId,
              pipelineId: pipelineConfig.id ?? null,
              pipelineAgentId: isUuid(event.agentId) ? event.agentId : null,
              role: event.role,
              label: event.label,
              // H9 : modelId RÉEL de l'agent (def.modelOverride) ; fallback sur
              // le modèle global de la conversation quand l'agent hérite.
              modelId: event.modelId ?? modelOverride ?? null,
              providerType,
              status: "success",
              inputTokens: event.inputTokens ?? null,
              outputTokens: event.outputTokens ?? null,
              latencyMs: event.latencyMs,
              output: event.preview ?? null,
              startedAt: new Date(startedAt),
              finishedAt: new Date(),
            });
            return;
          }

          if (event.type === "agent_error") {
            const startedAt = agentStarts.get(event.agentId) ?? Date.now();
            pendingRuns.push({
              conversationId: finalConversationId,
              pipelineId: pipelineConfig.id ?? null,
              pipelineAgentId: isUuid(event.agentId) ? event.agentId : null,
              role: event.role,
              label: event.label,
              modelId: event.modelId ?? modelOverride ?? null,
              providerType,
              status: "error",
              latencyMs: Date.now() - startedAt,
              error: event.error,
              startedAt: new Date(startedAt),
              finishedAt: new Date(),
            });
          }
        },
      });

      // R1 : metadata du message. Le client (useChat.onFinish) y lit le
      // conversationId (maj URL d'une conversation neuve → /chat?id=…, survit
      // au refresh) et l'usage agrégé (pill coût, page usage, quota). Émis
      // APRÈS le run pour que finalUsage soit complet. Si l'utilisateur a
      // annulé, on n'émet pas (le tour est abandonné, rien à compter).
      if (!req.signal.aborted) {
        writer.write({
          type: "message-metadata",
          messageMetadata: {
            conversationId: finalConversationId,
            usage: {
              inputTokens: finalUsage.inputTokens ?? 0,
              outputTokens: finalUsage.outputTokens ?? 0,
            },
          },
        });
      }
    },
    onFinish: async ({ messages: streamMessages }) => {
      // Décision : un « Stop » n'enregistre PAS de réponse partielle. Le tour
      // est annulé proprement (pas de message tronqué, pas d'agent_runs
      // orphelins). L'utilisateur relance s'il le souhaite.
      if (req.signal.aborted) return;
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

      const [insertedAssistant] = await db
        .insert(messages)
        .values({
          conversationId: finalConversationId,
          role: "assistant",
          content: finalText,
          parts: savedParts.length > 0 ? savedParts : null,
          inputTokens: finalUsage.inputTokens ?? null,
          outputTokens: finalUsage.outputTokens ?? null,
          modelId: modelOverride ?? null,
        })
        .returning({ id: messages.id });

      // H9 : insère l'audit trail multi-agent, rattaché au message assistant
      // (messageId), pour qu'il soit relisible/exportable par message.
      if (pendingRuns.length > 0) {
        await db
          .insert(agentRuns)
          .values(
            pendingRuns.map((r) => ({ ...r, messageId: insertedAssistant.id }))
          );
      }

      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, finalConversationId));

      // RAG conversations : on indexe les messages de ce tour uniquement
      // quand la conversation appartient à un projet (maîtrise du coût
      // d'embedding). Best-effort — n'interrompt jamais la réponse.
      if (effectiveProjectId) {
        if (userMessageId && userMessageText) {
          await indexMessageForProject(
            userId,
            userMessageId,
            userMessageText
          );
        }
        await indexMessageForProject(userId, insertedAssistant.id, finalText);
      }
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
