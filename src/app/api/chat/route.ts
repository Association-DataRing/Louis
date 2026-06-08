import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { log } from "@/lib/log";
import {
  agentRuns,
  conversations,
  documents,
  messages,
  projectMemories,
  type SavedPart,
} from "@/db/schema";
import {
  extractAndStoreMemories,
  memoryExtractionEnabled,
} from "@/lib/memory-extract";
import { assessDeliverable } from "@/lib/orchestrator/verify";
import {
  documentArtifactFromToolResult,
  type DocumentArtifactMeta,
} from "@/lib/ai/tool-result";
import { recordAudit } from "@/lib/audit";
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
  type UntrustedBlock,
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
  /**
   * Émis par DefaultChatTransport : `submit-message` pour un nouvel envoi,
   * `regenerate-message` pour une régénération. En régénération le message
   * user existe déjà — on ne le ré-insère pas et on remplace l'ancienne
   * réponse au lieu de l'empiler.
   */
  trigger?: "submit-message" | "regenerate-message";
  messageId?: string;
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
  const isRegenerate = body.trigger === "regenerate-message";
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

  // Régénération : le message user existe déjà (tour initial). On purge
  // l'ancienne réponse assistant + son trail d'audit pour que la nouvelle la
  // REMPLACE au lieu de s'empiler (sinon doublons + coût compté deux fois).
  // Transaction : la suppression du message et de ses agent_runs est atomique.
  if (isRegenerate) {
    const [lastUserRow] = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, finalConversationId),
          eq(messages.role, "user")
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(1);
    if (lastUserRow) {
      await db.transaction(async (tx) => {
        const removed = await tx
          .delete(messages)
          .where(
            and(
              eq(messages.conversationId, finalConversationId),
              gt(messages.createdAt, lastUserRow.createdAt)
            )
          )
          .returning({ id: messages.id });
        if (removed.length > 0) {
          // agent_runs.messageId est en ON DELETE SET NULL → on les supprime
          // explicitement pour ne pas laisser de runs orphelins dans l'audit.
          await tx.delete(agentRuns).where(
            inArray(
              agentRuns.messageId,
              removed.map((r) => r.id)
            )
          );
        }
      });
    }
  }

  let userMessageId: string | null = null;
  let userMessageText = "";
  const lastUser = uiMessages.at(-1);
  // En régénération, NE PAS ré-insérer le message user (déjà en base) — sinon
  // il apparaît en double au reload.
  if (!isRegenerate && lastUser?.role === "user") {
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

  // Contenu NON-FIABLE du tour. Documents joints et compétences sont des
  // sources que Louis n'a pas écrites → injectées comme messages `user`
  // préfixés (cf. injectUntrustedContext), jamais dans le prompt système, pour
  // qu'une instruction cachée dans un PDF client ne soit pas lue avec la même
  // autorité que la déontologie ou la politique d'outils.
  const untrustedBlocks: UntrustedBlock[] = [];
  if (documentIds && documentIds.length > 0) {
    const docs = await db
      .select({
        filename: documents.filename,
        extractedText: documents.extractedText,
        extractionStatus: documents.extractionStatus,
      })
      .from(documents)
      .where(
        and(eq(documents.userId, userId), inArray(documents.id, documentIds))
      );

    for (const d of docs) {
      if (d.extractedText) {
        // Quand le texte a été tronqué à l'extraction (gros document), on le
        // signale DANS le bloc : sans ça le modèle répond avec assurance sur un
        // contrat à moitié lu. Il sait alors qu'il doit déférer à search_documents
        // (RAG) pour le reste.
        const notice =
          d.extractionStatus === "truncated"
            ? "\n\n[⚠️ Document tronqué à l'extraction — seul le début est inclus ici. Pour le reste, utilise search_documents (RAG) plutôt que de répondre sur la seule partie visible.]"
            : "";
        untrustedBlocks.push({
          kind: "document",
          label: d.filename,
          text: `${d.extractedText}${notice}`,
        });
      }
    }
  }

  // ─── Détection automatique de skills ────────────────────────────────
  // Avant de lancer l'orchestrateur, on demande à un classificateur
  // léger quelles skills (parmi celles activées par l'utilisateur) sont
  // pertinentes pour la demande. Leurs system prompts sont alors injectés
  // comme bloc non-fiable (une compétence est éditable par l'utilisateur,
  // donc traitée comme donnée). L'utilisateur n'a rien à toggle manuellement.
  let detectedSkillSlugs: string[] = [];
  try {
    const lastUserText = extractTextPreview(lastUser);
    // Les simples accusés de réception (« ok », « merci », « continue »…) n'ont
    // jamais besoin d'une compétence : on évite l'appel LLM de classification,
    // qui est bloquant avant le 1er token. On NE filtre PAS sur la longueur
    // seule — une requête juridique peut être courte (« bail ? », « art. L442-1 ? »).
    const isAck =
      /^(ok(ay)?|merci|oui|non|parfait|super|nickel|continue|vas[- ]?y|go|d['’ ]?accord)[\s.!…]*$/i.test(
        lastUserText.trim()
      );
    if (lastUserText && !isAck) {
      const userSkills = await getEnabledSkills(userId);
      if (userSkills.length > 0) {
        // Classification de slugs : on n'a pas besoin du gros modèle de la
        // conversation. On force le modèle PAR DÉFAUT de la clé (moins cher)
        // plutôt que l'override choisi par l'utilisateur (qui peut être un Opus).
        const detectorModel = modelFromKey(
          await loadProviderKey(userId, providerKeyId),
          null
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
            untrustedBlocks.push({
              kind: "skill",
              label: "Compétences activées",
              text: skillsBlock,
            });
          }
        }
      }
    }
  } catch {
    // Best-effort : si la détection plante (capacity, timeout…), on
    // continue sans skills plutôt que de bloquer la conversation.
  }

  // ─── Recall mémoire du dossier ──────────────────────────────────────
  // On injecte UNIQUEMENT les faits VALIDÉS par un humain (status approved) —
  // les faits « pending » n'influencent jamais une réponse. Scopé au dossier
  // (jamais global) et traité comme donnée non-fiable.
  if (effectiveProjectId) {
    const mems = await db
      .select({
        category: projectMemories.category,
        text: projectMemories.text,
      })
      .from(projectMemories)
      .where(
        and(
          eq(projectMemories.userId, userId),
          eq(projectMemories.projectId, effectiveProjectId),
          eq(projectMemories.status, "approved")
        )
      )
      .limit(100);
    if (mems.length > 0) {
      untrustedBlocks.push({
        kind: "memory",
        label: "Mémoire validée du dossier",
        text: mems.map((m) => `- [${m.category}] ${m.text}`).join("\n"),
      });
    }
  }

  // États mutables capturés par les callbacks de streamText (savedParts du
  // message final pour ré-hydrater les tool calls au reload) et par
  // onEvent (audit trail multi-agent dans agent_runs).
  const savedParts: SavedPart[] = [];
  // Artefacts documents (generate/edit_document) produits ce tour — persistés
  // dans messages.metadata, source de vérité pour la carte d'artefact côté
  // client. Indépendant de la reconstruction des tool parts (fragile au reload)
  // et de la prose du modèle.
  const docArtifacts: DocumentArtifactMeta[] = [];
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
          untrustedBlocks: untrustedBlocks.length > 0 ? untrustedBlocks : undefined,
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
    onError: (error) => {
      // Sans onError, l'AI SDK renvoie un générique "An error occurred." au
      // client ET n'écrit rien côté serveur : les erreurs riches de
      // l'orchestrateur (échec provider, retries épuisés, débatteurs en
      // échec…) étaient masquées et non diagnostiquables. On logue le détail
      // et on renvoie un message exploitable.
      log.error("chat-stream", "Erreur pendant la génération", {
        conversationId: finalConversationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return error instanceof Error && error.message
        ? error.message
        : "Une erreur est survenue pendant la génération.";
    },
    onFinish: async ({ messages: streamMessages }) => {
      // Décision : un « Stop » n'enregistre PAS de réponse partielle. Le tour
      // est annulé proprement (pas de message tronqué, pas d'agent_runs
      // orphelins). L'utilisateur relance s'il le souhaite.
      if (req.signal.aborted) return;
      // H3 : toute la persistance est gardée. Un échec DB (insert message,
      // agent_runs…) est loggé au lieu d'être silencieusement avalé et ne fait
      // plus planter la finalisation du stream sans trace.
      try {
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
              // Capture l'artefact document pour le persister en metadata
              // (état terminal output-available garanti, contrairement au
              // tool-call/input-available qui peut manquer après agrégation).
              const artifact = documentArtifactFromToolResult(
                toolName,
                toolPart.output
              );
              if (
                artifact &&
                !docArtifacts.some(
                  (a) => a.documentId === artifact.documentId
                )
              ) {
                docArtifacts.push(artifact);
              }
            }
          } else if (PERSISTED_DATA_PARTS.has(part.type)) {
            // H3a : persiste le trail multi-agents (events/outputs/retries) +
            // skills détectées pour qu'ils survivent au reload (theatre,
            // badges d'étapes, pills « Compétence appliquée »).
            const dataPart = part as { type: string; data?: unknown };
            savedParts.push({
              type: "data",
              dataType: dataPart.type,
              data: capAgentOutput(dataPart.type, dataPart.data),
            });
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
          metadata:
            docArtifacts.length > 0 ? { documents: docArtifacts } : null,
          inputTokens: finalUsage.inputTokens ?? null,
          outputTokens: finalUsage.outputTokens ?? null,
          modelId: modelOverride ?? null,
        })
        .returning({ id: messages.id });

      // Vérification du livrable : si un outil effectif (generate/edit_document)
      // a été utilisé, on trace dans l'audit s'il a réellement abouti. Capture
      // le cas « le modèle annonce avoir créé le document alors que l'outil a
      // silencieusement échoué » — défendabilité d'un livrable juridique.
      const deliverable = assessDeliverable(savedParts);
      if (deliverable.hadEffectful) {
        await recordAudit({
          userId,
          action: deliverable.allOk
            ? "deliverable.verified"
            : "deliverable.failed",
          target: finalConversationId,
          meta: deliverable.allOk
            ? undefined
            : { failures: deliverable.failures },
        });
      }

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

      // Extraction mémoire (désactivée par défaut — coût d'un appel LLM). Crée
      // des faits en statut « pending » (jamais utilisés avant validation
      // humaine). Best-effort, ne perturbe jamais le chat.
      if (
        effectiveProjectId &&
        userMessageText &&
        memoryExtractionEnabled()
      ) {
        try {
          const model = modelFromKey(
            await loadProviderKey(userId, providerKeyId),
            modelOverride ?? null
          );
          await extractAndStoreMemories({
            model,
            userId,
            projectId: effectiveProjectId,
            sourceMessageId: userMessageId,
            userText: userMessageText,
            assistantText: finalText,
          });
        } catch {
          // best-effort
        }
      }
      } catch (err) {
        log.error("chat-persist", "Échec de la persistance de la réponse", {
          conversationId: finalConversationId,
          error: err instanceof Error ? err.message : String(err),
        });
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

// Data parts du trail multi-agents persistés (H3a). On exclut data-final-text
// (non consommé au rendu) et tout autre data part transitoire.
const PERSISTED_DATA_PARTS = new Set<string>([
  "data-agent-event",
  "data-agent-output",
  "data-agent-retry",
  "data-skills-detected",
]);

/** Cap la taille du texte intermédiaire persisté (data-agent-output) pour ne
 * pas faire exploser la colonne jsonb sur les conversations longues. */
function capAgentOutput(dataType: string, data: unknown): unknown {
  if (dataType !== "data-agent-output") return data;
  if (data && typeof data === "object" && "output" in data) {
    const d = data as { output?: unknown };
    if (typeof d.output === "string" && d.output.length > 12_000) {
      return { ...data, output: `${d.output.slice(0, 12_000)}…` };
    }
  }
  return data;
}
