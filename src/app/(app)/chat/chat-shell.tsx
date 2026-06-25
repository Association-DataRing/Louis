"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import {
  AgentEventBadge,
  dedupeAgentEvents,
  type AgentEventData,
  type AgentRetryData,
} from "./agent-event-badge";
import {
  LiveWorkflowPanel,
  type LiveAgentState,
} from "./live-workflow-panel";
import {
  AgentTheatre,
  buildAgentTurns,
  OpenTheatreButton,
  type AgentTurn,
} from "./agent-theatre";
import { ChatErrorBanner } from "./chat-error-banner";
import { ComposerMenu } from "./composer-menu";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { LouisLogo } from "@/components/louis-logo";
import { ModuleHelp } from "@/components/module-help";
import { Dropzone, uploadDocument } from "@/components/dropzone";
import { useSmoothText } from "@/lib/use-smooth-text";
import { useStickToBottom } from "@/lib/use-stick-to-bottom";
import { cn } from "@/lib/utils";
import { ThinkingIndicator } from "./thinking-indicator";
import { ReasoningBlock } from "./reasoning-block";
import { ApprovalCard, type ApprovalRequestData } from "./approval-card";
import { AgentStepsWrapper } from "./agent-steps-wrapper";
import {
  ToolTimeline,
  JsonDetail,
  type ToolTimelineRow,
} from "./tool-timeline";
import {
  AssistantMessageActions,
  extractTextFromParts,
  type ModelOption,
} from "./assistant-message-actions";
import { ModelPicker } from "./model-picker";
import { editUserMessageAndTrim } from "./actions";
import { uiPartsFromSaved } from "@/lib/ai/saved-parts";
import {
  unwrapToolResult,
  type DocumentArtifactMeta,
} from "@/lib/ai/tool-result";
import type { SavedPart, MessageMetadata } from "@/db/schema/messages";
import { DocPanel } from "./doc-panel";
import { EditCard } from "./edit-card";
import {
  IconArrowUp,
  IconArrowUpRight,
  IconArrowDown,
  IconPaperclip,
  IconUpload,
  IconFolder,
  IconChevronRight,
  IconX,
  IconTool,
  IconPlayerStop,
  IconFileText,
  IconLibrary,
  IconDownload,
  IconFileTypePdf,
  IconFileTypeDocx,
  IconAlertTriangle,
  IconPencil,
  IconEye,
} from "@tabler/icons-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  PROVIDER_CATALOG,
  SOVEREIGNTY_LABEL,
  type ProviderType,
} from "@/lib/providers/catalog";
import { MODEL_CATALOG, DEFAULT_MODEL } from "@/lib/providers/models";
import { computeCost, formatCost } from "@/lib/providers/pricing";
import { estimateCalls, estimateRunCost } from "@/lib/orchestrator/cost-estimate";
import {
  LegifranceCitations,
  PappersResults,
  PappersCompany,
  type LegifranceHitView,
  type PappersResultView,
  type PappersDetailsView,
} from "./citation-cards";

type KeyOption = {
  id: string;
  label: string;
  type: ProviderType;
  isDefault: boolean;
};

type DocumentOption = {
  id: string;
  filename: string;
  sizeBytes: number;
  folderId?: string | null;
};

type FolderOption = {
  id: string;
  name: string;
  parentFolderId: string | null;
};

type Usage = {
  inputTokens: number;
  outputTokens: number;
};

type WorkflowOption = {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
};

type PipelineAgentOption = {
  id: string;
  role: string;
  label: string;
};

type PipelineOption = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isPreset: boolean;
  agentCount: number;
  /** Mode d'exécution — pilote l'estimation du nombre d'appels LLM. */
  mode: "sequential" | "council" | "parallel" | "iterative" | "maestro";
  /** Tours de débat (mode council). null/1 sinon. */
  rounds: number | null;
  agents: PipelineAgentOption[];
};

export type EnabledModel = {
  providerType: ProviderType;
  modelId: string;
  label: string;
  hint?: string | null;
};

type Props = {
  providerKeys: KeyOption[];
  initialProviderKeyId: string;
  initialModelId: string | null;
  initialConversationId: string | null;
  initialProjectId: string | null;
  initialPipelineId?: string | null;
  initialPrompt?: string | null;
  projectContext: { id: string; name: string } | null;
  initialMessages: {
    id: string;
    role: string;
    content: string;
    parts: SavedPart[] | null;
    metadata?: unknown;
  }[];
  availableDocuments: DocumentOption[];
  folders: FolderOption[];
  workflows: WorkflowOption[];
  pipelines: PipelineOption[];
  /**
   * Modèles ajoutés par l'utilisateur dans /settings/models/library —
   * source de vérité du picker modèle. Le hardcoded MODEL_CATALOG est
   * utilisé en fallback uniquement si la liste est vide pour ce type.
   */
  enabledModels?: EnabledModel[];
  initialUsage: Usage;
  /** Mapping slug → libellé des compétences activées (H4). */
  skillLabels?: Record<string, string>;
};

function toUIMessages(rows: Props["initialMessages"]): UIMessage[] {
  return rows.map((m) => {
    const parts =
      m.parts && m.parts.length > 0
        ? uiPartsFromSaved(m.parts)
        : ([{ type: "text", text: m.content }] as UIMessage["parts"]);
    return {
      id: m.id,
      role: m.role as UIMessage["role"],
      parts,
    };
  });
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  return `${(n / 1000).toFixed(1)}k`;
}

// Escape les caractères regex spéciaux pour un littéral sûr.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Détecte les mentions de noms de fichiers dans le texte de l'assistant et
 * les transforme en liens markdown protocole `louis-doc:<id>`. Le component
 * `a` custom de ReactMarkdown intercepte ces liens et les rend comme
 * boutons cliquables qui ouvrent le DocPanel.
 *
 * Utile parce que les tool calls (search_documents) ne sont pas persistés
 * en DB — au rechargement d'une conversation, seul le texte reste. Les
 * mentions de filename sont la trace la plus robuste qu'on peut récupérer.
 */
function linkifyDocMentions(
  raw: string,
  docs: { id: string; filename: string }[]
): string {
  if (!docs.length) return raw;
  // Tri par longueur décroissante : on traite d'abord les filenames longs
  // pour éviter qu'un fichier "rapport.pdf" cannibalise "rapport_v2.pdf".
  const sorted = [...docs].sort((a, b) => b.filename.length - a.filename.length);
  let out = raw;
  for (const d of sorted) {
    if (!d.filename) continue;
    const fn = escapeRegex(d.filename);
    // 1) Lien markdown EXPLICITE du modèle [filename](url) → on réécrit le
    //    href vers louis-doc: pour ouvrir le panneau (au lieu de naviguer
    //    vers une URL souvent erronée). Couvre aussi les conversations
    //    rechargées, où les tool parts ne sont plus là pour rendre la carte.
    out = out.replace(
      new RegExp(`\\[(${fn})\\]\\([^)]*\\)`, "g"),
      `[$1](louis-doc:${d.id})`
    );
    // 2) Mention BRUTE du filename (hors lien) → rendue cliquable. On exclut
    //    le texte déjà dans un lien (?<!\[ … ?!\]) pour ne pas ré-emballer ce
    //    que l'étape 1 vient de produire.
    out = out.replace(
      new RegExp(`(?<!\\]\\()(?<!\\[)(${fn})(?!\\))(?!\\])`, "g"),
      `[$1](louis-doc:${d.id})`
    );
  }
  return out;
}

const TOOL_LABEL: Record<string, string> = {
  pappers_search: "Pappers · recherche",
  pappers_get: "Pappers · fiche entreprise",
  legifrance_search: "Légifrance · recherche",
  search_documents: "Recherche dans vos documents",
  list_documents: "Inventaire des documents",
  read_document: "Lecture d'un document",
  find_in_document: "Recherche exacte dans un document",
  generate_document: "Génération de document",
  edit_document: "Édition en tracked changes",
};

/**
 * Texte présent pendant l'exécution (« Création du document… »,
 * « Application des changes… ») pour donner un feedback explicite à
 * l'utilisateur au lieu du seul nom de tool en gris.
 */
const TOOL_PENDING_VERB: Record<string, string> = {
  pappers_search: "Recherche Pappers en cours…",
  pappers_get: "Récupération de la fiche entreprise…",
  legifrance_search: "Recherche Légifrance en cours…",
  search_documents: "Recherche dans vos documents…",
  list_documents: "Listing de vos documents…",
  read_document: "Lecture du document…",
  find_in_document: "Recherche dans le document…",
  generate_document: "Création du document…",
  edit_document: "Application des tracked changes…",
};

function formatToolInput(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const obj = input as Record<string, unknown>;
  if (typeof obj.query === "string") return `« ${obj.query} »`;
  if (typeof obj.siren === "string") return `SIREN ${obj.siren}`;
  if (typeof obj.title === "string") return `« ${obj.title} »`;
  if (typeof obj.needle === "string") return `« ${obj.needle} »`;
  if (Array.isArray(obj.edits)) return `${obj.edits.length} édit${obj.edits.length > 1 ? "s" : ""}`;
  return "";
}

type SearchDocumentsHit = {
  documentId: string;
  filename: string;
  chunk: number;
  content: string;
  similarity: number;
};

type GeneratedDocument = {
  document_id: string;
  filename: string;
  format: "docx" | "pdf";
};

type EditedDocument = {
  document_id: string;
  filename: string;
  format: "docx";
  applied_count: number;
  errors_count: number;
  applied: Array<{
    index: number;
    find: string;
    replace: string;
    reason?: string;
    paragraph: number;
  }>;
  errors: Array<{
    index: number;
    reason: string;
    message: string;
  }>;
};

type DocCard =
  | { variant: "edited"; documentId: string; doc: EditedDocument }
  | {
      variant: "download";
      documentId: string;
      filename: string;
      format: "docx" | "pdf";
      title: string;
    };

/**
 * Construit les cartes d'artefact document d'un message assistant (façon
 * Claude/Sana), dédupliquées par documentId. Trois sources, par priorité :
 *  1. Tool parts LIVE (pendant le stream) → carte la plus riche (édition avec
 *     ses détails de changes).
 *  2. metadata PERSISTÉE (messages.metadata.documents) → survit au remount de
 *     ChatShell (key=?id au 1er message) ET au reload dur, indépendamment de
 *     ce que le modèle écrit. C'est la source de vérité quand les tool parts
 *     ne se reconstruisent pas de façon fiable depuis la DB.
 *  3. Filet ultime : un document CONNU cité par son nom de fichier dans le
 *     texte (legacy / messages sans metadata).
 */
function buildDocCards(
  parts: { type: string; output?: unknown }[],
  persisted: DocumentArtifactMeta[],
  text: string,
  knownDocs: { id: string; filename: string }[]
): DocCard[] {
  const byId = new Map<string, DocCard>();

  // 1. Tool parts live (les plus riches).
  for (const p of parts) {
    if (p.type === "tool-generate_document") {
      const d = unwrapToolResult<GeneratedDocument>(p.output);
      if (d?.document_id && !byId.has(d.document_id)) {
        byId.set(d.document_id, {
          variant: "download",
          documentId: d.document_id,
          filename: d.filename,
          format: d.format,
          title: "Document généré",
        });
      }
    } else if (p.type === "tool-edit_document") {
      const d = unwrapToolResult<EditedDocument>(p.output);
      if (d?.document_id && !byId.has(d.document_id)) {
        byId.set(d.document_id, {
          variant: "edited",
          documentId: d.document_id,
          doc: d,
        });
      }
    }
  }

  // 2. metadata persistée (survit remount/reload, source de vérité).
  for (const a of persisted) {
    if (byId.has(a.documentId)) continue;
    byId.set(a.documentId, {
      variant: "download",
      documentId: a.documentId,
      filename: a.filename,
      format: a.format,
      title: a.kind === "edited" ? "Document modifié" : "Document généré",
    });
  }

  // 3. Filet ultime : mention du filename d'un doc connu dans le texte. Ne
  // s'active QUE si aucun artefact n'a été capté par les sources fiables (#1
  // tool parts, #2 metadata) — sinon un simple rappel d'un fichier existant
  // (« comme dans contrat.docx ») créait une fausse carte de téléchargement.
  // Les mentions légitimes restent cliquables via linkifyDocMentions (inline).
  if (text && byId.size === 0) {
    for (const d of knownDocs) {
      if (!d.filename || byId.has(d.id)) continue;
      if (text.includes(d.filename)) {
        byId.set(d.id, {
          variant: "download",
          documentId: d.id,
          filename: d.filename,
          format: /\.pdf$/i.test(d.filename) ? "pdf" : "docx",
          title: "Document",
        });
      }
    }
  }

  return [...byId.values()];
}

function DocumentDownloadCard({
  title,
  filename,
  documentId,
  format,
  onPreview,
}: {
  title: string;
  filename: string;
  documentId: string;
  format: "docx" | "pdf";
  onPreview: () => void;
}) {
  const Icon = format === "pdf" ? IconFileTypePdf : IconFileTypeDocx;
  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 max-w-[85%] flex items-center gap-3 transition-shadow hover:shadow-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-300">
      <button
        type="button"
        onClick={onPreview}
        className="size-10 rounded-md bg-card border border-border flex items-center justify-center shrink-0 hover:border-primary transition-colors cursor-pointer"
        aria-label="Aperçu"
        title="Aperçu"
      >
        <Icon className="size-5 text-primary" />
      </button>
      <button
        type="button"
        onClick={onPreview}
        className="min-w-0 flex-1 text-left"
      >
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="text-sm font-medium truncate">{filename}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {format === "pdf" ? "Document PDF" : "Document Word (.docx)"}
        </p>
      </button>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-accent transition-colors"
        >
          <IconEye className="size-3.5" />
          Voir
        </button>
        <a
          href={`/api/documents/${documentId}/file?download=1`}
          download={filename}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <IconDownload className="size-3.5" />
          Télécharger
        </a>
      </div>
    </div>
  );
}

function EditedDocumentCard({
  documentId,
  filename,
  applied,
  errors,
  appliedCount,
  errorsCount,
  onPreview,
}: {
  documentId: string;
  filename: string;
  applied: EditedDocument["applied"];
  errors: EditedDocument["errors"];
  appliedCount: number;
  errorsCount: number;
  onPreview: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden max-w-[85%] transition-shadow hover:shadow-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-300">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/40">
        <button
          type="button"
          onClick={onPreview}
          className="flex items-center gap-2 min-w-0 text-left hover:text-primary transition-colors"
          aria-label="Aperçu"
        >
          <IconPencil className="size-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{filename}</p>
            <p className="text-[10px] text-muted-foreground">
              {appliedCount} édition{appliedCount > 1 ? "s" : ""} appliquée
              {appliedCount > 1 ? "s" : ""}
              {errorsCount > 0 && (
                <span className="text-destructive">
                  {" · "}
                  {errorsCount} en erreur
                </span>
              )}
              {" · cliquez pour prévisualiser"}
            </p>
          </div>
        </button>
        <a
          href={`/api/documents/${documentId}/file?download=1`}
          download={filename}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
        >
          <IconDownload className="size-3.5" />
          Télécharger
        </a>
      </header>

      {applied.length > 0 && (
        <ul className="divide-y divide-border">
          {applied.slice(0, 8).map((edit) => (
            <li key={edit.index} className="px-4 py-3 text-xs">
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="bg-destructive/5 border border-destructive/15 rounded px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-destructive font-semibold mb-0.5">
                    Avant
                  </p>
                  <p className="font-mono text-foreground/80 line-through decoration-destructive/40">
                    {edit.find}
                  </p>
                </div>
                <div className="bg-primary/5 border border-primary/15 rounded px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-0.5">
                    Après
                  </p>
                  <p className="font-mono">{edit.replace || <em className="text-muted-foreground">(suppression)</em>}</p>
                </div>
              </div>
              {edit.reason && (
                <p className="mt-1.5 text-[11px] text-muted-foreground italic">
                  {edit.reason}
                </p>
              )}
            </li>
          ))}
          {applied.length > 8 && (
            <li className="px-4 py-2 text-[11px] text-muted-foreground text-center">
              + {applied.length - 8} autre
              {applied.length - 8 > 1 ? "s" : ""} édition
              {applied.length - 8 > 1 ? "s" : ""} dans le document.
            </li>
          )}
        </ul>
      )}

      {errors.length > 0 && (
        <div className="border-t border-border bg-destructive/5 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-destructive mb-1">
            <IconAlertTriangle className="size-3.5" />
            Édits non appliqués
          </div>
          <ul className="text-[11px] text-muted-foreground space-y-0.5">
            {errors.slice(0, 5).map((e) => (
              <li key={e.index}>· {e.message}</li>
            ))}
          </ul>
        </div>
      )}

      <footer className="px-4 py-2 border-t border-border bg-muted/20 text-[10px] text-muted-foreground">
        Marques de révision Word natives — ouvrez le fichier dans Word /
        Pages / LibreOffice et utilisez l&apos;onglet Révision pour
        Accepter ou Refuser chaque modification.
      </footer>
    </div>
  );
}

/** Outils ayant un rendu RICHE dédié (citations…) dans le détail de la
 * timeline — le reste tombe sur le détail JSON. NB : generate_document /
 * edit_document ne sont PLUS ici : leur artefact est désormais une carte
 * proéminente au niveau du message (cf. extractDocArtifacts), inutile de le
 * dupliquer dans le détail dépliable. */
const RICH_TOOLS = new Set([
  "search_documents",
  "legifrance_search",
  "pappers_search",
  "pappers_get",
]);

/** Construit les lignes de la timeline d'outils à partir des parts d'un message. */
function buildToolRows(
  parts: { type: string; input?: unknown; output?: unknown; state?: string }[]
): ToolTimelineRow[] {
  const rows: ToolTimelineRow[] = [];
  parts.forEach((part, i) => {
    if (typeof part.type !== "string" || !part.type.startsWith("tool-")) return;
    const name = part.type.replace(/^tool-/, "");
    const pending =
      part.state === "input-streaming" || part.state === "input-available";
    rows.push({
      id: `tool-${i}`,
      name,
      label: TOOL_LABEL[name] ?? name,
      summary: formatToolInput(part.input),
      pending,
      // Tout est replié par défaut (look minimaliste) — le détail s'ouvre au clic.
      autoExpand: false,
      input: part.input,
      output: part.output,
    });
  });
  return rows;
}

/** Somme des latences d'agents (data-agent-event/agent_finish) du message. */
function sumAgentLatency(parts: { type: string; data?: unknown }[]): number {
  let total = 0;
  for (const part of parts) {
    if (part.type !== "data-agent-event") continue;
    const d = part.data as { type?: string; latencyMs?: number } | undefined;
    if (d?.type === "agent_finish" && typeof d.latencyMs === "number") {
      total += d.latencyMs;
    }
  }
  return total;
}

function ToolPart({
  name,
  input,
  output,
  state,
  onOpenDoc,
}: {
  name: string;
  input?: unknown;
  output?: unknown;
  state?: string;
  onOpenDoc: (documentId: string, targetText: string) => void;
}) {
  const label = TOOL_LABEL[name] ?? name;
  const inputSummary = formatToolInput(input);
  const isPending = state === "input-streaming" || state === "input-available";

  // generate_document → carte de téléchargement (.docx ou .pdf)
  if (name === "generate_document" && !isPending) {
    const d = unwrapToolResult<GeneratedDocument>(output);
    if (d && d.document_id) {
      return (
        <DocumentDownloadCard
          title="Document généré"
          filename={d.filename}
          documentId={d.document_id}
          format={d.format ?? "docx"}
          onPreview={() =>
            onOpenDoc(d.document_id, "")
          }
        />
      );
    }
  }

  // edit_document → carte récap des changes + bouton download .docx édité
  if (name === "edit_document" && !isPending) {
    const d = unwrapToolResult<EditedDocument>(output);
    if (d && d.document_id) {
      return (
        <EditedDocumentCard
          documentId={d.document_id}
          filename={d.filename}
          applied={d.applied ?? []}
          errors={d.errors ?? []}
          appliedCount={d.applied_count ?? 0}
          errorsCount={d.errors_count ?? 0}
          onPreview={() => onOpenDoc(d.document_id, "")}
        />
      );
    }
  }

  // search_documents → rendu spécial avec sources cliquables
  if (
    name === "search_documents" &&
    !isPending &&
    Array.isArray(output) &&
    output.length > 0
  ) {
    const hits = output as SearchDocumentsHit[];
    return (
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs flex flex-col gap-1.5 max-w-[85%]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <IconTool className="size-3 text-primary" />
          <span className="font-medium text-foreground">{label}</span>
          {inputSummary && <span className="truncate">· {inputSummary}</span>}
          <span className="ml-auto text-[10px]">
            {hits.length} extrait{hits.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {hits.map((h, i) => (
            <button
              key={`${h.documentId}-${h.chunk}-${i}`}
              type="button"
              onClick={() => onOpenDoc(h.documentId, h.content)}
              className="text-left flex items-center gap-2 rounded-md bg-background border border-border px-2 py-1.5 hover:border-primary/50 transition-colors group"
            >
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                #{h.chunk}
              </span>
              <span className="text-xs truncate flex-1 min-w-0 group-hover:text-foreground text-muted-foreground">
                <span className="font-medium text-foreground">{h.filename}</span>
                <span className="ml-2">{h.content.slice(0, 80)}…</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // R3 : citations Légifrance / Pappers cliquables (au lieu de jeter les URLs
  // sources dans une pill grise « Terminé »).
  if (name === "legifrance_search" && !isPending) {
    const d = unwrapToolResult<{ query: string; hits: LegifranceHitView[] }>(
      output
    );
    if (d?.hits?.length) return <LegifranceCitations hits={d.hits} />;
  }

  if (name === "pappers_search" && !isPending) {
    const d = unwrapToolResult<{
      query: string;
      total: number;
      results: PappersResultView[];
    }>(output);
    if (d?.results?.length) return <PappersResults results={d.results} />;
  }

  if (name === "pappers_get" && !isPending) {
    const d = unwrapToolResult<PappersDetailsView>(output);
    if (d?.siren) return <PappersCompany d={d} />;
  }

  return (
    <div className="relative overflow-hidden rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs flex items-center gap-2 max-w-[80%]">
      {isPending ? (
        <span
          className="size-3 rounded-full border border-muted-foreground/70 border-t-transparent animate-spin shrink-0"
          aria-hidden
        />
      ) : (
        <IconTool className="size-3 text-primary" />
      )}
      <span className="font-medium">
        {isPending ? TOOL_PENDING_VERB[name] ?? `${label}…` : label}
      </span>
      {inputSummary && !isPending && (
        <span className="text-muted-foreground truncate">· {inputSummary}</span>
      )}
    </div>
  );
}

function WorkflowPickerContent({
  workflows,
  onPick,
}: {
  workflows: WorkflowOption[];
  onPick: (prompt: string) => void;
}) {
  if (workflows.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Aucun workflow pour l&apos;instant.
        </p>
        <Link
          href="/workflows"
          className="mt-2 inline-block text-xs text-primary hover:underline underline-offset-2"
        >
          Créer un workflow →
        </Link>
      </div>
    );
  }
  return (
    <div className="max-h-96 overflow-y-auto py-1">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <IconLibrary className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Trames</p>
        <Link
          href="/workflows"
          className="ml-auto text-[10px] text-primary hover:underline underline-offset-2"
        >
          Gérer
        </Link>
      </div>
      <div className="divide-y divide-border">
        {workflows.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => onPick(w.prompt)}
            className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex flex-col gap-0.5"
          >
            <span className="text-sm font-medium">{w.name}</span>
            {w.description && (
              <span className="text-[11px] text-muted-foreground truncate">
                {w.description}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Détermine si un message assistant a déjà commencé à produire du texte
 * affichable — utilisé pour décider si l'AgentStepsWrapper doit se replier
 * (le texte a pris le relais sur les étapes intermédiaires).
 */
function hasRenderableText(
  parts: { type: string; text?: string }[]
): boolean {
  return parts.some(
    (p) =>
      p.type === "text" &&
      typeof p.text === "string" &&
      p.text.trim().length > 0
  );
}

/**
 * Bloc markdown d'un message assistant. Quand `isLive` est vrai (dernier
 * message, streaming en cours), le texte est lissé via useSmoothText pour
 * un rendu char-par-char à ~60fps indépendant du débit SSE. Sur les
 * messages historiques, render direct sans buffer.
 */
const AssistantMarkdownPart = memo(function AssistantMarkdownPart({
  text,
  isLive,
  mergedDocuments,
  onOpenDoc,
}: {
  text: string;
  isLive: boolean;
  mergedDocuments: DocumentOption[];
  onOpenDoc: (documentId: string, targetText: string) => void;
}) {
  const smoothed = useSmoothText(text, { done: !isLive });
  const display = isLive ? smoothed : text;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      // rehype-highlight colore les blocs de code (contrats, JSON, sorties
      // d'outils). `ignoreMissing` laisse les langages inconnus — dont notre
      // bloc spécial `edit` — en texte brut, donc l'interception EditCard
      // ci-dessous continue de fonctionner.
      rehypePlugins={[[rehypeHighlight, { ignoreMissing: true, detect: true }]]}
      components={{
        code: ({ className, children, ...rest }) => {
          const lang = (className ?? "").match(/language-(\w+)/)?.[1];
          if (lang === "edit") {
            return <EditCard raw={String(children).replace(/\n$/, "")} />;
          }
          return (
            <code className={className} {...rest}>
              {children}
            </code>
          );
        },
        a: ({ href, children, ...rest }) => {
          if (typeof href === "string" && href.startsWith("louis-doc:")) {
            const docId = href.slice("louis-doc:".length);
            return (
              <button
                type="button"
                onClick={() => onOpenDoc(docId, "")}
                className="inline-flex items-center gap-1 rounded bg-muted hover:bg-accent px-1.5 py-0.5 text-[0.85em] font-medium not-prose transition-colors no-underline align-baseline"
              >
                <IconFileText className="size-3 shrink-0" />
                {children}
              </button>
            );
          }
          // Tout autre lien (écrit par le modèle) s'ouvre dans un nouvel
          // onglet : un clic ne doit jamais détruire la session de chat.
          return (
            <a {...rest} href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          );
        },
      }}
    >
      {linkifyDocMentions(display, mergedDocuments)}
    </ReactMarkdown>
  );
});

/** Ligne document (feuille) avec case à cocher, indentée selon la profondeur. */
function DocLeaf({
  doc,
  depth,
  selected,
  onToggle,
}: {
  doc: DocumentOption;
  depth: number;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <label
      className="flex items-center gap-2.5 py-1.5 pr-3 hover:bg-accent cursor-pointer rounded-md"
      style={{ paddingLeft: 12 + depth * 16 }}
    >
      <Checkbox checked={selected} onCheckedChange={() => onToggle(doc.id)} />
      <span className="flex-1 text-sm truncate">{doc.filename}</span>
    </label>
  );
}

/** Nœud dossier repliable + son contenu (sous-dossiers puis documents). */
function FolderNode({
  folder,
  depth,
  childrenByParent,
  docsByFolder,
  selected,
  collapsed,
  toggleCollapse,
  onToggle,
}: {
  folder: FolderOption;
  depth: number;
  childrenByParent: Map<string | null, FolderOption[]>;
  docsByFolder: Map<string | null, DocumentOption[]>;
  selected: string[];
  collapsed: Set<string>;
  toggleCollapse: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const isCollapsed = collapsed.has(folder.id);
  const subFolders = (childrenByParent.get(folder.id) ?? []).filter((f) =>
    folderHasDocs(f.id, childrenByParent, docsByFolder)
  );
  const docs = docsByFolder.get(folder.id) ?? [];
  return (
    <div>
      <button
        type="button"
        onClick={() => toggleCollapse(folder.id)}
        className="w-full flex items-center gap-1.5 py-1.5 pr-3 hover:bg-accent rounded-md text-left"
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        <IconChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            !isCollapsed && "rotate-90"
          )}
        />
        <IconFolder className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-sm font-medium truncate">{folder.name}</span>
      </button>
      {!isCollapsed && (
        <>
          {subFolders.map((f) => (
            <FolderNode
              key={f.id}
              folder={f}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              docsByFolder={docsByFolder}
              selected={selected}
              collapsed={collapsed}
              toggleCollapse={toggleCollapse}
              onToggle={onToggle}
            />
          ))}
          {docs.map((doc) => (
            <DocLeaf
              key={doc.id}
              doc={doc}
              depth={depth + 1}
              selected={selected.includes(doc.id)}
              onToggle={onToggle}
            />
          ))}
        </>
      )}
    </div>
  );
}

/** Vrai si le dossier (ou un descendant) contient au moins un document. */
function folderHasDocs(
  folderId: string,
  childrenByParent: Map<string | null, FolderOption[]>,
  docsByFolder: Map<string | null, DocumentOption[]>
): boolean {
  if ((docsByFolder.get(folderId) ?? []).length > 0) return true;
  return (childrenByParent.get(folderId) ?? []).some((f) =>
    folderHasDocs(f.id, childrenByParent, docsByFolder)
  );
}

/**
 * Picker de documents en ARBORESCENCE réelle : dossiers et sous-dossiers
 * (parentFolderId) repliables, documents en feuilles. Les dossiers sans aucun
 * document (direct ou descendant) sont élagués. Les documents sans dossier
 * (racine, ex. fichiers tout juste téléversés) apparaissent en bas.
 */
function DocPickerContent({
  documents,
  folders,
  selected,
  onToggle,
}: {
  documents: DocumentOption[];
  folders: FolderOption[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const { childrenByParent, docsByFolder, rootFolders, rootDocs } = useMemo(() => {
    const childrenByParent = new Map<string | null, FolderOption[]>();
    for (const f of folders) {
      const key = f.parentFolderId;
      const arr = childrenByParent.get(key) ?? [];
      arr.push(f);
      childrenByParent.set(key, arr);
    }
    const folderIds = new Set(folders.map((f) => f.id));
    const docsByFolder = new Map<string | null, DocumentOption[]>();
    for (const d of documents) {
      // Un folderId inconnu (dossier filtré/supprimé) retombe en racine.
      const key = d.folderId && folderIds.has(d.folderId) ? d.folderId : null;
      const arr = docsByFolder.get(key) ?? [];
      arr.push(d);
      docsByFolder.set(key, arr);
    }
    return {
      childrenByParent,
      docsByFolder,
      rootFolders: childrenByParent.get(null) ?? [],
      rootDocs: docsByFolder.get(null) ?? [],
    };
  }, [documents, folders]);

  if (documents.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Aucun document avec texte extrait.
        </p>
        <Link
          href="/documents"
          className="mt-2 inline-block text-xs text-primary hover:underline underline-offset-2"
        >
          Importer un fichier →
        </Link>
      </div>
    );
  }

  const visibleRootFolders = rootFolders.filter((f) =>
    folderHasDocs(f.id, childrenByParent, docsByFolder)
  );

  return (
    <div className="max-h-72 overflow-y-auto py-1">
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs font-medium">Joindre au prompt</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Le texte extrait sera inséré dans le system prompt.
        </p>
      </div>
      <div className="p-1">
        {visibleRootFolders.map((f) => (
          <FolderNode
            key={f.id}
            folder={f}
            depth={0}
            childrenByParent={childrenByParent}
            docsByFolder={docsByFolder}
            selected={selected}
            collapsed={collapsed}
            toggleCollapse={toggleCollapse}
            onToggle={onToggle}
          />
        ))}
        {rootDocs.map((doc) => (
          <DocLeaf
            key={doc.id}
            doc={doc}
            depth={0}
            selected={selected.includes(doc.id)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

// Défauts stables (référence constante) pour ne pas invalider le memo de
// MessageRow : un `?? []` inline créerait un nouveau tableau à chaque render.
const EMPTY_ATTACHMENTS: string[] = [];
const EMPTY_ARTIFACTS: DocumentArtifactMeta[] = [];

type MessageRowProps = {
  message: UIMessage;
  /** Dernier message assistant ET stream en cours — seule ligne réactive. */
  isLive: boolean;
  /** Stream/submit en cours (désactive les actions). Stable token-à-token. */
  isBusy: boolean;
  mergedDocuments: DocumentOption[];
  /** Artefacts persistés de CE message (documentArtifactsByMessageId[id]). */
  persistedArtifacts: DocumentArtifactMeta[];
  /** Doc ids joints à CE message (attachmentsByMessageId[id]). */
  attachments: string[];
  isEditing: boolean;
  /** Brouillon d'édition — significatif seulement si isEditing. */
  editingDraft: string;
  editError: string | null;
  selectedModelValue: string;
  assistantActionModels: ModelOption[];
  onOpenDoc: (documentId: string, targetText: string) => void;
  onStartEditing: (messageId: string, currentText: string) => void;
  onCancelEditing: () => void;
  onSaveEditing: (messageId: string, draftText: string) => void;
  onChangeDraft: (value: string) => void;
  onOpenTheatre: (messageId: string) => void;
  onRegenerateCurrent: () => void;
  onRegenerateWithModel: (modelKey: string) => void;
};

/**
 * Une ligne de message du fil. Mémoïsée : pendant le streaming, `useChat`
 * recrée le tableau `messages` à chaque token mais ne mute QUE l'objet du
 * message en cours — les objets historiques gardent leur référence. Avec
 * React.memo + props stables (callbacks useCallback, slices par message), le
 * memo bypasse les N-1 lignes historiques et ne re-rend que la ligne live.
 *
 * Les calculs lourds par message (buildToolRows, buildDocCards,
 * dedupeAgentEvents, sumAgentLatency) sont mémoïsés sur `message.parts` :
 * recalculés uniquement quand les parts changent — donc seulement sur la
 * ligne en streaming.
 */
const MessageRow = memo(function MessageRow({
  message: m,
  isLive,
  isBusy,
  mergedDocuments,
  persistedArtifacts,
  attachments,
  isEditing,
  editingDraft,
  editError,
  selectedModelValue,
  assistantActionModels,
  onOpenDoc,
  onStartEditing,
  onCancelEditing,
  onSaveEditing,
  onChangeDraft,
  onOpenTheatre,
  onRegenerateCurrent,
  onRegenerateWithModel,
}: MessageRowProps) {
  const isUser = m.role === "user";

  const dedupedAgentEvents = useMemo(
    () =>
      isUser
        ? []
        : dedupeAgentEvents(m.parts as { type: string; data?: unknown }[]),
    [isUser, m.parts]
  );

  const toolRows = useMemo(
    () =>
      isUser
        ? []
        : buildToolRows(
            m.parts as {
              type: string;
              input?: unknown;
              output?: unknown;
              state?: string;
            }[]
          ),
    [isUser, m.parts]
  );

  const firstToolIdx = useMemo(
    () =>
      m.parts.findIndex(
        (p) => typeof p.type === "string" && p.type.startsWith("tool-")
      ),
    [m.parts]
  );

  const docCards = useMemo(
    () =>
      isUser
        ? []
        : buildDocCards(
            m.parts as { type: string; output?: unknown }[],
            persistedArtifacts,
            extractTextFromParts(m.parts as { type: string; text?: string }[]),
            mergedDocuments
          ),
    [isUser, m.parts, persistedArtifacts, mergedDocuments]
  );

  const toolDurationMs = useMemo(
    () => sumAgentLatency(m.parts as { type: string; data?: unknown }[]),
    [m.parts]
  );

  const renderToolDetail = useCallback(
    (row: ToolTimelineRow) =>
      RICH_TOOLS.has(row.name) ? (
        <ToolPart
          name={row.name}
          input={row.input}
          output={row.output}
          state="output-available"
          onOpenDoc={onOpenDoc}
        />
      ) : (
        <JsonDetail input={row.input} output={row.output} />
      ),
    [onOpenDoc]
  );

  return (
    <div
      aria-label={isUser ? "Vous" : "Louis"}
      className={`flex flex-col gap-1.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 ${isUser ? "items-end" : "items-start group/msg"}`}
    >
      {/* Wrapper d'étapes : utile UNIQUEMENT pour pipelines
          multi-agents (2+ agents distincts). En mode chat-simple
          mono-agent, le seul step serait « Assistant Louis ·
          Travaille / Terminé » — redondant avec le markdown qui
          se déroule et le ThinkingIndicator. On revient au
          stream IA classique. */}
      {dedupedAgentEvents.length > 1 && (
        <div className="w-full max-w-xl">
          <AgentStepsWrapper
            stepCount={dedupedAgentEvents.length}
            shouldMinimize={hasRenderableText(
              m.parts as { type: string; text?: string }[]
            )}
            isStreaming={isLive}
          >
            {dedupedAgentEvents.map((evt, i) => (
              <AgentEventBadge
                key={evt.agentId}
                event={evt}
                isLive={isLive}
                showConnector={i < dedupedAgentEvents.length - 1}
              />
            ))}
          </AgentStepsWrapper>
          {/* Accès PERMANENT à la délibération de ce message (le
              panneau live disparaît, pas ça). */}
          {!isLive && (
            <div className="mt-1">
              <OpenTheatreButton onClick={() => onOpenTheatre(m.id)} />
            </div>
          )}
        </div>
      )}
      {m.parts.map((part, i) => {
        if (part.type === "data-agent-event") {
          // Rendu déjà fait via dedupedAgentEvents au-dessus —
          // on skippe ici pour éviter les doublons.
          return null;
        }
        if (part.type === "data-approval-request") {
          // Garde-fou human-in-the-loop : un outil sensible
          // attend le feu vert. Actionnable uniquement pendant
          // le streaming (la part n'est pas persistée).
          const data = (part as { data?: ApprovalRequestData }).data;
          if (!data?.approvalId) return null;
          return (
            <ApprovalCard
              key={`approval-${data.approvalId}`}
              data={data}
              isLive={isLive}
            />
          );
        }
        if (part.type === "reasoning") {
          // Tokens de raisonnement d'un modèle « thinking »
          // (DeepSeek R1, Magistral, o-series, Claude extended
          // thinking…). Rendu dans un bloc repliable, jamais
          // injecté dans la réponse finale.
          const reasoningText = (part as { text?: string }).text;
          if (!reasoningText) return null;
          const reasoningStreaming =
            isLive && (part as { state?: string }).state !== "done";
          return (
            <ReasoningBlock
              key={i}
              text={reasoningText}
              isStreaming={reasoningStreaming}
            />
          );
        }
        if (part.type === "text") {
          if (isUser) {
            if (isEditing) {
              return (
                <div
                  key={i}
                  className="w-full max-w-[85%] flex flex-col gap-2"
                >
                  <textarea
                    value={editingDraft}
                    onChange={(e) => onChangeDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") onCancelEditing();
                      if (
                        (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ||
                        (e.key === "Enter" && !e.shiftKey)
                      ) {
                        e.preventDefault();
                        onSaveEditing(m.id, editingDraft);
                      }
                    }}
                    autoFocus
                    rows={Math.min(
                      6,
                      Math.max(2, editingDraft.split("\n").length)
                    )}
                    className="w-full resize-none rounded-2xl border border-input bg-card px-4 py-3 text-[15px] leading-[1.55] focus:outline-none focus:ring-2 focus:ring-ring/40"
                  />
                  {editError && (
                    <p className="text-xs text-destructive">{editError}</p>
                  )}
                  <div className="flex justify-end items-center gap-2 text-xs">
                    <span className="text-muted-foreground mr-auto">
                      Entrée pour envoyer · Échap pour annuler
                    </span>
                    <button
                      type="button"
                      onClick={onCancelEditing}
                      className="px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveEditing(m.id, editingDraft)}
                      disabled={!editingDraft.trim() || isBusy}
                      className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      Envoyer
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={i}
                className="group/user relative max-w-[85%] flex flex-col items-end gap-1.5"
              >
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {attachments.map((docId) => {
                      const doc = mergedDocuments.find((d) => d.id === docId);
                      return (
                        <Badge
                          key={docId}
                          variant="secondary"
                          className="gap-1 text-[11px]"
                        >
                          <IconPaperclip className="size-3" />
                          <span className="max-w-[200px] truncate">
                            {doc?.filename ?? `Document ${docId.slice(0, 8)}`}
                          </span>
                        </Badge>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-start gap-1 w-full justify-end">
                  <button
                    type="button"
                    onClick={() => onStartEditing(m.id, part.text ?? "")}
                    disabled={isBusy}
                    title="Modifier cette question"
                    aria-label="Modifier cette question"
                    className="opacity-0 group-hover/user:opacity-100 focus:opacity-100 inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-opacity disabled:opacity-0 mt-1"
                  >
                    <IconPencil className="size-3.5" />
                  </button>
                  <div className="rounded-2xl px-4 py-3 text-[15px] leading-[1.55] whitespace-pre-wrap bg-secondary text-foreground">
                    {part.text}
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div
              key={i}
              className="w-full text-[15px] leading-[1.65] prose prose-neutral dark:prose-invert max-w-none prose-base prose-pre:my-2 prose-headings:font-heading prose-headings:tracking-tight prose-p:my-2 prose-ul:my-2.5 prose-li:my-0.5"
            >
              {part.text ? (
                <AssistantMarkdownPart
                  text={part.text}
                  isLive={isLive}
                  mergedDocuments={mergedDocuments}
                  onOpenDoc={onOpenDoc}
                />
              ) : (
                <Spinner className="size-4" />
              )}
            </div>
          );
        }
        if (typeof part.type === "string" && part.type.startsWith("tool-")) {
          // Tous les outils du message sont consolidés dans UNE
          // timeline, rendue à la position du premier outil ; les
          // suivants sont skippés.
          if (i !== firstToolIdx) return null;
          return (
            <ToolTimeline
              key={i}
              rows={toolRows}
              durationMs={toolDurationMs}
              isStreaming={isLive}
              renderDetail={renderToolDetail}
            />
          );
        }
        return null;
      })}

      {/* Artefacts documents — cartes proéminentes (façon Claude/
          Sana) : un document généré/édité doit être un objet de
          premier plan, pas un lien noyé dans la prose. */}
      {!isUser && docCards.length > 0 && (
        <div className="flex w-full flex-col gap-2">
          {docCards.map((c) =>
            c.variant === "edited" ? (
              <EditedDocumentCard
                key={`art-${c.documentId}`}
                documentId={c.documentId}
                filename={c.doc.filename}
                applied={c.doc.applied}
                errors={c.doc.errors}
                appliedCount={c.doc.applied_count}
                errorsCount={c.doc.errors_count}
                onPreview={() => onOpenDoc(c.documentId, "")}
              />
            ) : (
              <DocumentDownloadCard
                key={`art-${c.documentId}`}
                title={c.title}
                filename={c.filename}
                documentId={c.documentId}
                format={c.format}
                onPreview={() => onOpenDoc(c.documentId, "")}
              />
            )
          )}
        </div>
      )}
      {/* Actions au survol du message assistant — masquées
          pendant le streaming et sur les messages user. */}
      {!isUser && !isLive && (
        <div className="opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity -mt-1">
          <AssistantMessageActions
            text={extractTextFromParts(
              m.parts as { type: string; text?: string }[]
            )}
            currentModelId={selectedModelValue}
            availableModels={assistantActionModels}
            onRegenerate={onRegenerateCurrent}
            onRegenerateWith={onRegenerateWithModel}
            disabled={isBusy}
          />
        </div>
      )}
    </div>
  );
});

export function ChatShell({
  providerKeys,
  initialProviderKeyId,
  initialModelId,
  initialConversationId,
  initialProjectId,
  initialPipelineId,
  initialPrompt,
  projectContext,
  initialMessages,
  availableDocuments,
  folders,
  workflows,
  pipelines,
  enabledModels,
  initialUsage,
  skillLabels = {},
}: Props) {
  const router = useRouter();
  const [providerKeyId, setProviderKeyId] = useState(initialProviderKeyId);
  // Sélection de pipeline orchestrateur. Priorité :
  // 1. initialPipelineId (deep-link depuis /board "Essayer")
  // 2. preset "chat-simple"
  // 3. première pipeline disponible
  const defaultPipelineId =
    (initialPipelineId &&
      pipelines.find((p) => p.id === initialPipelineId)?.id) ??
    pipelines.find((p) => p.slug === "chat-simple")?.id ??
    pipelines[0]?.id ??
    null;
  const [pipelineId, setPipelineId] = useState<string | null>(defaultPipelineId);
  const [usage, setUsage] = useState<Usage>(initialUsage);
  const initialType =
    providerKeys.find((k) => k.id === initialProviderKeyId)?.type ?? "mistral";
  const [modelId, setModelId] = useState<string>(
    initialModelId ?? DEFAULT_MODEL[initialType]
  );
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId
  );
  const [attachedDocIds, setAttachedDocIds] = useState<string[]>([]);
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [workflowPickerOpen, setWorkflowPickerOpen] = useState(false);
  // Map messageId → liste de docIds joints à ce message-là. Initialisé
  // depuis le `metadata` des messages persistés en DB, puis enrichi en
  // session via `pendingAttachmentsRef` quand l'utilisateur envoie un
  // nouveau message avec doc joint.
  const [attachmentsByMessageId, setAttachmentsByMessageId] = useState<
    Record<string, string[]>
  >(() => {
    const initial: Record<string, string[]> = {};
    for (const m of initialMessages) {
      const meta = m.metadata as MessageMetadata | null;
      if (meta?.documentIds && meta.documentIds.length > 0) {
        initial[m.id] = meta.documentIds;
      }
    }
    return initial;
  });
  // Artefacts documents persistés par message id — source de vérité de la
  // carte d'artefact (survit au remount ChatShell key=?id ET au reload dur,
  // sans dépendre de la prose ni de la reconstruction fragile des tool parts).
  // Reconstruit à chaque mount depuis les initialMessages DB (frais au remount).
  const documentArtifactsByMessageId = useMemo(() => {
    const map: Record<string, DocumentArtifactMeta[]> = {};
    for (const m of initialMessages) {
      const docs = (m.metadata as MessageMetadata | null)?.documents;
      if (docs && docs.length > 0) map[m.id] = docs;
    }
    return map;
  }, [initialMessages]);
  // Tampon des docIds en attente d'être associés au prochain message user
  // qui apparaît dans le store useChat (l'AI SDK génère l'ID côté client,
  // on ne le connaît pas avant que le message ne soit pushé).
  const pendingAttachmentsRef = useRef<string[]>([]);
  // Documents téléversés à la volée via drag-and-drop. Ajoutés à
  // `availableDocuments` côté UI (picker + badges) sans round-trip au
  // server component. Au prochain render server (nouvelle conv, refresh)
  // ils repasseront naturellement par `availableDocuments`.
  const [localDocs, setLocalDocs] = useState<DocumentOption[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Panneau document à droite (citation cliquée OU document auto-ouvert
  // après generate/edit_document). Persisté en sessionStorage pour survivre
  // au remount qui se produit quand l'URL passe de /chat à /chat?id=xxx.
  //
  // useState init lazy lit sessionStorage côté client uniquement. Pour
  // éviter le hydration mismatch sur <aside>, on rend le panneau derrière
  // un flag `mounted` (useSyncExternalStore returns false server, true
  // client). SSR : aside non rendu. 1er client render = même chose qu'
  // SSR. Après hydratation, mounted bascule à true et l'aside apparaît.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  // L'entrée sessionStorage embarque la conv d'origine du panel pour qu'on
  // sache distinguer 2 situations au mount :
  //  - Remount automatique pendant le 1er message d'une conv (URL passe de
  //    /chat à /chat?id=xxx) : openDoc.conversationId === null, on garde
  //    le panel et on lui adopte la nouvelle conv.
  //  - Switch vers une autre conv via sidebar : openDoc.conversationId !==
  //    currentConvId → on ferme le panel (purge sessionStorage).
  const [openDoc, setOpenDocState] = useState<{
    documentId: string;
    targetText: string;
  } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage.getItem("louis:openDoc");
      if (!raw) return null;
      const stored = JSON.parse(raw) as {
        documentId: string;
        targetText: string;
        conversationId: string | null;
      };
      // Si on entre dans une conv différente de celle qui a ouvert le panel,
      // purge — sauf cas null → id (création de conv en cours).
      if (
        stored.conversationId !== null &&
        stored.conversationId !== initialConversationId
      ) {
        window.sessionStorage.removeItem("louis:openDoc");
        return null;
      }
      return { documentId: stored.documentId, targetText: stored.targetText };
    } catch {
      return null;
    }
  });
  const setOpenDoc = useCallback(
    (next: { documentId: string; targetText: string } | null) => {
      setOpenDocState(next);
      if (typeof window === "undefined") return;
      try {
        if (next) {
          window.sessionStorage.setItem(
            "louis:openDoc",
            JSON.stringify({ ...next, conversationId: initialConversationId })
          );
        } else {
          window.sessionStorage.removeItem("louis:openDoc");
        }
      } catch {}
    },
    [initialConversationId]
  );
  // Fermeture animée du DocPanel : on joue le slide-out (via la prop
  // `closing`) puis on démonte au bout de la durée d'anim. Sous
  // prefers-reduced-motion, on ferme directement (pas de délai mort).
  const [docClosing, setDocClosing] = useState(false);
  const closeDoc = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setOpenDoc(null);
      return;
    }
    setDocClosing(true);
    window.setTimeout(() => {
      setOpenDoc(null);
      setDocClosing(false);
    }, 220);
  }, [setOpenDoc]);
  // Adaptateur stable (signature ReactMarkdown/ToolPart → setOpenDoc) pour que
  // `React.memo(AssistantMarkdownPart)` ne se ré-invalide pas à chaque token :
  // les messages historiques ne re-rendent plus pendant le streaming.
  const handleOpenDoc = useCallback(
    (documentId: string, targetText: string) =>
      setOpenDoc({ documentId, targetText }),
    [setOpenDoc]
  );
  // Tracking des document_id déjà auto-ouverts dans le DocPanel pour ne
  // pas réouvrir à chaque re-render. Survit au remount qui se produit
  // quand l'URL passe de /chat à /chat?id=xxx via sessionStorage.
  const lastAutoOpenedDocId = useRef<string | null>(
    typeof window !== "undefined"
      ? window.sessionStorage.getItem("louis:lastAutoOpenedDoc")
      : null
  );
  // Ids des messages présents AU MONTAGE (chargés depuis la DB). L'auto-open
  // du DocPanel ne doit se déclencher que pour une génération FRAÎCHE de la
  // session — pas pour un document reconstruit au reload/réouverture d'une
  // conversation (sinon le panneau s'ouvrirait tout seul à chaque réouverture
  // maintenant que les tool parts se reconstruisent au reload).
  const initialMessageIds = useMemo(
    () => new Set(initialMessages.map((m) => m.id)),
    [initialMessages]
  );


  const selectedKey = providerKeys.find((k) => k.id === providerKeyId);
  const selectedType: ProviderType = selectedKey?.type ?? "mistral";
  const selectedMeta = PROVIDER_CATALOG[selectedType];

  // Tous les modèles activés par l'utilisateur, à travers TOUS les
  // providers connectés. Le sélecteur unifié les présente avec le
  // provider en hint à droite — pas besoin de double dropdown.
  const allEnabledModels = useMemo(() => {
    if (!enabledModels) return [];
    // Garde uniquement les modèles dont le providerType a au moins une
    // clé active chez l'utilisateur (sinon impossible d'appeler).
    const activeTypes = new Set(providerKeys.map((k) => k.type));
    return enabledModels.filter((m) => activeTypes.has(m.providerType));
  }, [enabledModels, providerKeys]);

  // Fallback historique : si l'utilisateur n'a aucun modèle ajouté
  // (situation transitoire ou nouveau provider non encore exploré), on
  // expose le catalogue curé du provider sélectionné — sinon picker vide.
  const fallbackOptions = MODEL_CATALOG[selectedType].map((m) => ({
    providerType: selectedType,
    modelId: m.id,
    label: m.label,
    hint: m.hint ?? null,
  }));
  const unifiedModels =
    allEnabledModels.length > 0 ? allEnabledModels : fallbackOptions;

  // Pour le composer : trouve la clé provider à utiliser quand on
  // sélectionne un modèle. Priorité à la clé par défaut, sinon la
  // première active du même type. useCallback : consommé par les handlers
  // de régénération passés à MessageRow mémoïsé — doit rester stable.
  const findKeyForModel = useCallback(
    (modelProviderType: string): string | null => {
      const matching = providerKeys.filter((k) => k.type === modelProviderType);
      if (matching.length === 0) return null;
      const def = matching.find((k) => k.isDefault);
      return (def ?? matching[0]).id;
    },
    [providerKeys]
  );

  function handleModelChange(newModelId: string) {
    // Le value du Select est "providerType:modelId" pour garantir
    // l'unicité (un même modelId peut exister chez plusieurs providers
    // — par exemple "claude-sonnet-4.5" en direct Anthropic ET via
    // OpenRouter en "anthropic/claude-sonnet-4.5"). On split.
    const sepIdx = newModelId.indexOf(":");
    if (sepIdx < 0) {
      setModelId(newModelId);
      return;
    }
    const ptype = newModelId.slice(0, sepIdx);
    const mid = newModelId.slice(sepIdx + 1);
    const keyId = findKeyForModel(ptype);
    if (keyId) setProviderKeyId(keyId);
    setModelId(mid);
    // Persiste le dernier choix pour qu'une nouvelle conversation
    // reparte sur ce modèle au lieu du DEFAULT_MODEL hardcodé.
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("louis:lastModel", newModelId);
      } catch {
        // Quota / private mode — ignore silencieusement.
      }
    }
  }

  // Restaure le dernier modèle utilisé au montage UNIQUEMENT pour les
  // nouvelles conversations (pas de currentId → initialModelId null).
  // Pour les conversations existantes on respecte le modelId stocké en DB
  // — sinon on écraserait un choix volontaire passé.
  //
  // Pattern one-shot client-side : on ne peut pas lire localStorage en
  // SSR (sinon hydration mismatch), donc on défère via queueMicrotask
  // pour ne pas violer la règle react-hooks/set-state-in-effect (les
  // setState ne sont pas exécutés dans le body de l'effet mais dans un
  // microtask suivant).
  useEffect(() => {
    if (initialConversationId) return;
    if (initialModelId) return;
    if (typeof window === "undefined") return;
    const last = window.localStorage.getItem("louis:lastModel");
    if (!last) return;
    const sepIdx = last.indexOf(":");
    if (sepIdx < 0) return;
    const ptype = last.slice(0, sepIdx);
    const mid = last.slice(sepIdx + 1);
    // Vérifie que le provider de ce modèle a toujours une clé active —
    // sinon le restore aboutirait sur un état non utilisable.
    const keyId =
      providerKeys.filter((k) => k.type === ptype).find((k) => k.isDefault)
        ?.id ??
      providerKeys.find((k) => k.type === ptype)?.id ??
      null;
    if (!keyId) return;
    queueMicrotask(() => {
      setProviderKeyId(keyId);
      setModelId(mid);
    });
    // Exec une seule fois au mount — pas de deps dynamiques.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedModelValue = `${selectedType}:${modelId}`;
  const modelOptions = unifiedModels;

  // Liste des modèles présentée dans le sous-menu d'actions « Régénérer
  // avec un autre modèle ». Format identique au selectedModelValue pour
  // qu'un même handler parse provider+model.
  const assistantActionModels: ModelOption[] = useMemo(
    () =>
      unifiedModels.map((m) => ({
        id: `${m.providerType}:${m.modelId}`,
        label: m.label,
        hint: m.hint ?? null,
      })),
    [unifiedModels]
  );

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    []
  );

  // Annonce de complétion pour lecteurs d'écran (région live dédiée, à part
  // du thread streamé). Vide pendant le stream, renseigné dans onFinish.
  const [statusText, setStatusText] = useState("");

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    error,
    stop,
    regenerate,
  } = useChat({
    messages: toUIMessages(initialMessages),
    transport,
    // Throttle les re-renders du store de messages à 50ms (20Hz). En
    // dessous, l'AI SDK déclenche un setState par chunk SSE — pour des
    // modèles rapides (Mistral, Claude Haiku) ça peut atteindre 100+
    // re-renders/s, ce qui sature le main thread et fait trembler le
    // markdown. Couplé avec useSmoothText sur le rendu, on a un débit
    // d'affichage stable indépendant du rythme du provider.
    experimental_throttle: 50,
    onFinish: ({ message }) => {
      setStatusText("Réponse de Louis terminée.");
      const meta = message?.metadata as
        | { conversationId?: string; usage?: Usage }
        | undefined;
      if (meta?.conversationId && meta.conversationId !== conversationId) {
        setConversationId(meta.conversationId);
      }
      if (meta?.usage) {
        setUsage((u) => ({
          inputTokens: u.inputTokens + (meta.usage!.inputTokens ?? 0),
          outputTokens: u.outputTokens + (meta.usage!.outputTokens ?? 0),
        }));
      }
    },
  });

  useEffect(() => {
    if (!conversationId) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("id") === conversationId) return;
    // router.replace met à jour à la fois l'URL côté navigateur ET le router
    // Next (la sidebar peut donc lire le bon ?id via useSearchParams pour
    // highlight la conv active). { scroll: false } évite que la page remonte
    // en haut.
    router.replace(`/chat?id=${conversationId}`, { scroll: false });
  }, [conversationId, router]);

  // initialPrompt vient du deep-link "?prompt=" (CTA Essayer sur /board).
  // On le pré-remplit comme valeur initiale du composer, l'utilisateur
  // peut éditer/envoyer ou l'effacer.
  const [input, setInput] = useState(initialPrompt ?? "");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize du composer : la hauteur suit le contenu jusqu'à
  // ~10 lignes, au-delà un scroll interne apparaît. Re-mesure à chaque
  // changement de `input` — couvre la saisie manuelle, les workflows
  // insérés, le reset post-envoi.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Cap visuel à 240 px ≈ 10 lignes de text-[15px] leading-[1.55].
    // CSS max-h sur la textarea joue aussi le filet — ici on cale juste
    // la valeur calculée pour qu'inline match le visuel.
    const next = Math.min(el.scrollHeight, 240);
    el.style.height = `${next}px`;
  }, [input]);
  const isBusy = status === "submitted" || status === "streaming";
  const {
    containerRef: messagesScrollRef,
    isStuck,
    scrollToBottom,
  } = useStickToBottom<HTMLDivElement>();

  // Concaténation des documents disponibles côté serveur + ceux téléversés
  // pendant la session via drag-and-drop. Utilisé partout où on doit
  // résoudre un docId en filename (badges, picker, linkify).
  const mergedDocuments = useMemo(
    () => [...availableDocuments, ...localDocs],
    [availableDocuments, localDocs]
  );

  const handleDroppedFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setUploadError(null);
    setUploadingCount((n) => n + files.length);
    // Upload séquentiel volontaire : l'API /upload fait extraction + RAG
    // embedding (synchrone côté serveur). Plusieurs uploads en parallèle
    // saturent l'embedding provider. Le volume drag-drop typique reste
    // modeste (1-5 fichiers), la latence cumulée est acceptable.
    for (const file of files) {
      const result = await uploadDocument(file);
      if (result.ok) {
        setLocalDocs((prev) =>
          prev.some((d) => d.id === result.id)
            ? prev
            : [
                ...prev,
                {
                  id: result.id,
                  filename: result.filename,
                  sizeBytes: result.sizeBytes,
                  folderId: null,
                },
              ]
        );
        setAttachedDocIds((ids) =>
          ids.includes(result.id) ? ids : [...ids, result.id]
        );
      } else {
        setUploadError(`${file.name} — ${result.error}`);
      }
      setUploadingCount((n) => Math.max(0, n - 1));
    }
  }, []);

  // Édition d'un message utilisateur antérieur. State du message en cours
  // d'édition + draft du textarea inline. Le save persiste côté serveur
  // (drop des messages suivants en DB) puis tronque les messages côté
  // client et relance la génération.
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Raccourcis clavier globaux sur l'écran chat. Aligne le feeling sur
  // claude.ai / chatgpt :
  //  - Esc : stop la génération si en cours
  //  - ⌘/ ou Ctrl+/ : toggle sidebar (dialogue avec sidebar-content.tsx
  //    via localStorage + Event custom)
  //  - ⌘↑ ou Ctrl+↑ : ouvre l'édition sur le dernier message user
  // On n'override pas ⌘N (raccourci browser natif "nouvelle fenêtre" qu'on
  // ne peut pas intercepter en isolation).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.getAttribute("contenteditable") === "true";

      if (e.key === "Escape" && isBusy) {
        e.preventDefault();
        stop();
        return;
      }

      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const current =
          window.localStorage.getItem("louis:sidebarOpen") ?? "true";
        const next = current === "false" ? "true" : "false";
        window.localStorage.setItem("louis:sidebarOpen", next);
        window.dispatchEvent(new Event("louis:sidebarOpen-change"));
        return;
      }

      if (
        e.key === "ArrowUp" &&
        (e.metaKey || e.ctrlKey) &&
        !inField &&
        !isBusy
      ) {
        const lastUser = [...messages]
          .reverse()
          .find((mm) => mm.role === "user");
        if (!lastUser) return;
        const textPart = lastUser.parts.find(
          (p) =>
            p.type === "text" &&
            typeof (p as { text?: string }).text === "string"
        );
        if (!textPart) return;
        e.preventDefault();
        setEditingMessageId(lastUser.id);
        setEditingDraft((textPart as { text: string }).text);
        setEditError(null);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isBusy, stop, messages]);

  // Handlers passés à MessageRow mémoïsé → useCallback obligatoire pour que
  // le memo bypasse les messages historiques pendant le streaming. Leurs
  // deps (conversationId, modelId, attachedDocIds…) sont stables token-à-token.
  const startEditing = useCallback(
    (messageId: string, currentText: string) => {
      setEditingMessageId(messageId);
      setEditingDraft(currentText);
      setEditError(null);
    },
    []
  );

  const cancelEditing = useCallback(() => {
    setEditingMessageId(null);
    setEditingDraft("");
    setEditError(null);
    // Le textarea inline d'édition se démonte → rendre le focus au composer.
    composerRef.current?.focus();
  }, []);

  // `draftText` est passé en argument (au lieu de lire l'état editingDraft)
  // pour que ce callback reste stable à chaque frappe — sinon toutes les
  // lignes se re-rendraient pendant l'édition.
  const saveEditing = useCallback(
    async (messageId: string, draftText: string) => {
    const trimmed = draftText.trim();
    if (!trimmed) return;
    if (!conversationId) {
      setEditError("Aucune conversation active.");
      return;
    }
    setEditError(null);
    const result = await editUserMessageAndTrim(
      conversationId,
      messageId,
      trimmed
    );
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    // Tronque côté client : on garde tout jusqu'au message édité inclus,
    // on met à jour son texte, puis on relance regenerate avec le contexte
    // actuel. L'AI SDK enchainera comme s'il s'agissait du dernier message.
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      if (idx < 0) return prev;
      const kept = prev.slice(0, idx + 1).map((m, i) =>
        i === idx
          ? {
              ...m,
              parts: [{ type: "text", text: trimmed }] as typeof m.parts,
            }
          : m
      );
      return kept;
    });
    setEditingMessageId(null);
    setEditingDraft("");
    // Le textarea inline d'édition se démonte → rendre le focus au composer.
    composerRef.current?.focus();
    regenerate({
      body: {
        providerKeyId,
        conversationId,
        documentIds: attachedDocIds,
        modelOverride: modelId,
        projectId: initialProjectId,
        pipelineId,
      },
    });
    },
    [
      conversationId,
      providerKeyId,
      attachedDocIds,
      modelId,
      initialProjectId,
      pipelineId,
      regenerate,
      setMessages,
    ]
  );

  // Régénère le dernier message assistant avec le modèle actuel — équivalent
  // d'un retry de la même requête. Les events agents, tool calls et docs
  // joints sont conservés via les paramètres body que l'orchestrateur lit.
  const handleRegenerateCurrent = useCallback(() => {
    regenerate({
      body: {
        providerKeyId,
        conversationId,
        documentIds: attachedDocIds,
        modelOverride: modelId,
        projectId: initialProjectId,
        pipelineId,
      },
    });
  }, [
    regenerate,
    providerKeyId,
    conversationId,
    attachedDocIds,
    modelId,
    initialProjectId,
    pipelineId,
  ]);

  // Régénère avec un autre modèle. Switch le state model+provider à la
  // volée (pour que les futurs messages utilisent aussi ce modèle) puis
  // relance la requête avec les overrides body.
  const handleRegenerateWithModel = useCallback(
    (modelKey: string) => {
      const sepIdx = modelKey.indexOf(":");
      if (sepIdx < 0) return;
      const ptype = modelKey.slice(0, sepIdx);
      const mid = modelKey.slice(sepIdx + 1);
      const keyId = findKeyForModel(ptype);
      if (keyId) setProviderKeyId(keyId);
      setModelId(mid);
      regenerate({
        body: {
          providerKeyId: keyId ?? providerKeyId,
          conversationId,
          documentIds: attachedDocIds,
          modelOverride: mid,
          projectId: initialProjectId,
          pipelineId,
        },
      });
    },
    [
      findKeyForModel,
      regenerate,
      providerKeyId,
      conversationId,
      attachedDocIds,
      initialProjectId,
      pipelineId,
    ]
  );

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || isBusy) return;
    // Reset l'annonce live pour qu'elle se re-déclenche à la fin du tour.
    setStatusText("");
    // Mémorise les attachements pour les associer au message user qui
    // va apparaître dans `messages` au prochain tick (cf useEffect plus
    // bas qui consume cette ref).
    pendingAttachmentsRef.current = attachedDocIds;
    sendMessage(
      { text: trimmed },
      {
        body: {
          providerKeyId,
          conversationId,
          documentIds: attachedDocIds,
          modelOverride: modelId,
          projectId: initialProjectId,
          pipelineId,
        },
      }
    );
    setInput("");
    // Les documents joints valent pour CE message uniquement — vider la
    // pile pour le tour suivant, à la manière de claude.ai / chatgpt.
    // Le doc reste accessible via le picker / la sidebar /documents s'il
    // est nécessaire pour un prochain message.
    setAttachedDocIds([]);
    // Rend le focus au composer après envoi (le textarea reste monté ;
    // simplement disabled pendant le stream → focus revient au prochain
    // tour de saisie).
    composerRef.current?.focus();
  }

  // Associe les attachements pending au dernier message user dès qu'il
  // apparaît dans le store useChat. On compare l'ID pour ne pas écraser
  // une association précédente — pendingAttachmentsRef est vidé après
  // pour ne pas ré-attacher aux retries / regénérations.
  useEffect(() => {
    if (pendingAttachmentsRef.current.length === 0) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "user") return;
    if (attachmentsByMessageId[last.id]) return;
    const docs = pendingAttachmentsRef.current;
    pendingAttachmentsRef.current = [];
    setAttachmentsByMessageId((prev) => ({ ...prev, [last.id]: docs }));
  }, [messages, attachmentsByMessageId]);

  const isEmpty = messages.length === 0;

  // Pipeline sélectionnée + ses agents, pour piloter le LiveWorkflowPanel.
  const selectedPipeline = pipelines.find((p) => p.id === pipelineId);
  const isMultiAgent = (selectedPipeline?.agentCount ?? 0) > 1;

  // Calcule l'état de chaque agent du pipeline en cours en repassant sur
  // les data-agent-event du dernier message assistant. C'est piloté par
  // useChat (messages se met à jour à chaque chunk SSE) donc l'UI s'anime
  // en temps réel sans state custom.
  const liveAgents: LiveAgentState[] = useMemo(() => {
    if (!selectedPipeline) return [];
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const baseStates = selectedPipeline.agents.map<LiveAgentState>((a) => ({
      id: a.id,
      role: a.role,
      label: a.label,
      state: "idle",
    }));
    if (!lastAssistant?.parts) return baseStates;

    for (const part of lastAssistant.parts) {
      // H10 : retry d'un débatteur reflété dans le panel — la carte passe en
      // « nouvelle tentative N… » tant qu'elle n'a pas fini.
      if (part.type === "data-agent-retry") {
        const r = (part as { data?: AgentRetryData }).data;
        if (!r?.agentId) continue;
        const ridx = baseStates.findIndex((s) => s.id === r.agentId);
        if (ridx >= 0) {
          baseStates[ridx] = { ...baseStates[ridx], retryAttempt: r.attempt };
        }
        continue;
      }
      if (part.type !== "data-agent-event") continue;
      const data = (part as { data?: AgentEventData }).data;
      if (!data?.agentId) continue;
      const idx = baseStates.findIndex((s) => s.id === data.agentId);
      if (idx < 0) continue;
      if (data.type === "agent_start") {
        baseStates[idx] = { ...baseStates[idx], state: "active" };
      } else if (data.type === "agent_finish") {
        baseStates[idx] = {
          ...baseStates[idx],
          state: "done",
          latencyMs: data.latencyMs,
        };
      } else if (data.type === "agent_error") {
        baseStates[idx] = {
          ...baseStates[idx],
          state: "error",
          error: data.error,
        };
      }
    }
    return baseStates;
  }, [messages, selectedPipeline]);

  // H10 : tour courant d'un conseil multi-tours, dérivé du max `round` vu
  // dans les agent_start du dernier message assistant. Alimente le libellé
  // « Tour N/M » du panneau live (null hors council ou à 1 tour).
  const councilRound = useMemo<{ current: number; total: number } | null>(() => {
    if (!selectedPipeline || selectedPipeline.mode !== "council") return null;
    const total = selectedPipeline.rounds ?? 1;
    if (total <= 1) return null;
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAssistant?.parts) return null;
    let current = 0;
    for (const part of lastAssistant.parts) {
      if (part.type !== "data-agent-event") continue;
      const data = (part as { data?: AgentEventData }).data;
      if (
        data?.type === "agent_start" &&
        typeof data.round === "number" &&
        data.round > current
      ) {
        current = data.round;
      }
    }
    return current > 0 ? { current, total } : null;
  }, [messages, selectedPipeline]);

  // Dérivation pure : le panneau live s'affiche dès qu'au moins un agent
  // est actif/done/error dans la pipeline multi-agent en cours. Pas d'effet
  // à gérer — l'UI réagit naturellement aux nouveaux events.
  const someAgentActive = liveAgents.some((a) => a.state === "active");
  const someAgentDone = liveAgents.some(
    (a) => a.state === "done" || a.state === "error"
  );
  const [manuallyClosed, setManuallyClosed] = useState(false);
  // Reset du manual-close quand un nouveau run démarre (transition idle →
  // active). Pattern « update state based on prior state during render »
  // recommandé en React 19 (pas d'effet, donc pas de double render visible).
  const [prevActiveKey, setPrevActiveKey] = useState(false);
  if (someAgentActive !== prevActiveKey) {
    setPrevActiveKey(someAgentActive);
    if (someAgentActive) setManuallyClosed(false);
  }
  const livePanelOpen =
    isMultiAgent &&
    !manuallyClosed &&
    (someAgentActive || someAgentDone);

  // Theatre view : agrège les sorties intermédiaires (data-agent-output)
  // + le texte streamé du synthétiseur final. Reconstruit la timeline
  // chronologique de la délibération du conseil.
  // Théâtre : piloté par l'id du message à afficher (null = fermé). Permet de
  // rouvrir la délibération de N'IMPORTE quel message multi-agents passé, pas
  // seulement le dernier — avant, l'accès disparaissait avec le panneau live.
  const [theatreMessageId, setTheatreMessageId] = useState<string | null>(null);
  const lastAssistantId = useMemo(
    () =>
      [...messages].reverse().find((m) => m.role === "assistant")?.id ?? null,
    [messages]
  );
  const theatreTurns: AgentTurn[] = useMemo(() => {
    if (!selectedPipeline || !theatreMessageId) return [];
    const msg = messages.find((m) => m.id === theatreMessageId);
    if (!msg?.parts) return [];

    // Collecte les events agents + le texte final du message ciblé.
    const events: AgentEventData[] = [];
    let finalText = "";
    for (const part of msg.parts) {
      if (part.type === "data-agent-event") {
        const d = (part as { data?: AgentEventData }).data;
        if (d) events.push(d);
      } else if (part.type === "text") {
        const text = (part as { text?: string }).text;
        if (text) finalText += text;
      }
    }
    const isStreaming = isBusy && msg.id === messages[messages.length - 1]?.id;
    return buildAgentTurns(
      msg.parts as { type: string; data?: unknown; text?: string }[],
      events,
      finalText || null,
      isStreaming
    );
  }, [messages, selectedPipeline, isBusy, theatreMessageId]);

  // H4 : compétences détectées pour le dernier message assistant. Lues depuis
  // la part data-skills-detected (persistée par H3a → survit au reload) et
  // mappées en libellés lisibles.
  const appliedSkills: string[] = useMemo(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAssistant) return [];
    for (const part of lastAssistant.parts) {
      if (part.type === "data-skills-detected") {
        const slugs =
          (part as { data?: { slugs?: string[] } }).data?.slugs ?? [];
        return slugs.map((s) => skillLabels[s] ?? s);
      }
    }
    return [];
  }, [messages, skillLabels]);

  // H8 : estimation AU POINT DE DÉPENSE. Le nombre d'appels LLM est exact
  // (driver de coût d'un run multi-agents) ; le coût est une fourchette
  // (tokens de sortie inconnus → suffixé « estimé »). Recalculé à chaque
  // changement de modèle / pipeline / saisie, sans envoyer de requête.
  // Placé après les useMemo qui dépendent de selectedPipeline pour ne pas
  // casser la préservation de mémoïsation du React Compiler.
  const estimatedCalls = estimateCalls({
    mode: selectedPipeline?.mode ?? "sequential",
    agents: selectedPipeline?.agentCount ?? 1,
    rounds: selectedPipeline?.rounds ?? 1,
  });
  const estimatedRunCost = estimateRunCost({
    modelId,
    calls: estimatedCalls,
    promptChars: input.length,
  });

  // Auto-ouverture du DocPanel dès qu'un tool generate_document /
  // edit_document termine avec un document_id. On scanne les parts du
  // dernier message assistant et on prend le plus récent non vu.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || !last.parts) return;
    // Message chargé depuis la DB (présent au montage) → pas d'auto-open :
    // on n'ouvre le panneau que lorsqu'une génération vient de se terminer.
    if (initialMessageIds.has(last.id)) return;
    for (let i = last.parts.length - 1; i >= 0; i--) {
      const p = last.parts[i] as { type: string; output?: unknown };
      if (
        p.type !== "tool-generate_document" &&
        p.type !== "tool-edit_document"
      )
        continue;
      const d = unwrapToolResult<GeneratedDocument | EditedDocument>(p.output);
      if (!d || !d.document_id) continue;
      if (lastAutoOpenedDocId.current === d.document_id) return;
      lastAutoOpenedDocId.current = d.document_id;
      try {
        window.sessionStorage.setItem("louis:lastAutoOpenedDoc", d.document_id);
      } catch {}
      setOpenDoc({ documentId: d.document_id, targetText: "" });
      return;
    }
  }, [messages, setOpenDoc, initialMessageIds]);

  return (
    <Dropzone
      onFiles={handleDroppedFiles}
      disabled={isBusy}
      overlayLabel="Déposez pour joindre à la conversation"
      overlayHint="PDF, DOCX ou texte — 25 Mo max par fichier"
      className="flex-1 flex h-full min-w-0 w-full"
    >
    <div className="flex-1 flex flex-col h-full min-w-0 bg-background">
      {/* Breadcrumb projet — affiché UNIQUEMENT en contexte projet. Le coût
          et le badge de souveraineté ont migré dans le composer (immersion :
          plus de barre permanente en haut de l'écran). */}
      {projectContext && (
        <header className="border-b border-border px-6 py-2.5 flex items-center gap-3 text-xs">
          <Link
            href={`/projects/${projectContext.id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Voir le projet"
          >
            <span className="size-1.5 rounded-full bg-primary" />
            <span className="truncate max-w-[200px]">{projectContext.name}</span>
          </Link>
        </header>
      )}

      {/* Messages or empty state */}
      {/* Région live dédiée : annonce uniquement une string de complétion
          courte (cf. statusText) — n'enveloppe PAS le thread streamé pour
          éviter de ré-annoncer chaque token. */}
      <div className="sr-only" role="status" aria-live="polite">
        {statusText}
      </div>
      <div
        ref={messagesScrollRef}
        tabIndex={0}
        className="flex-1 overflow-y-auto relative"
        aria-busy={isBusy}
        aria-label="Conversation avec Louis"
      >
        {isEmpty ? (
          <EmptyState
            onPickSuggestion={(text) => {
              setInput(text);
              composerRef.current?.focus();
            }}
          />
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
            {messages.map((m, msgIdx) => {
              // Seul le dernier message assistant pendant un stream est
              // « live » — la seule ligne autorisée à se re-rendre token-à-
              // token. Toutes les autres bypassent le memo (objet message
              // référentiellement stable + props stables ci-dessous).
              const isLive =
                m.role !== "user" &&
                msgIdx === messages.length - 1 &&
                isBusy;
              const isEditingThis = editingMessageId === m.id;
              return (
                <MessageRow
                  key={m.id}
                  message={m}
                  isLive={isLive}
                  isBusy={isBusy}
                  mergedDocuments={mergedDocuments}
                  persistedArtifacts={
                    documentArtifactsByMessageId[m.id] ?? EMPTY_ARTIFACTS
                  }
                  attachments={attachmentsByMessageId[m.id] ?? EMPTY_ATTACHMENTS}
                  isEditing={isEditingThis}
                  editingDraft={isEditingThis ? editingDraft : ""}
                  editError={isEditingThis ? editError : null}
                  selectedModelValue={selectedModelValue}
                  assistantActionModels={assistantActionModels}
                  onOpenDoc={handleOpenDoc}
                  onStartEditing={startEditing}
                  onCancelEditing={cancelEditing}
                  onSaveEditing={saveEditing}
                  onChangeDraft={setEditingDraft}
                  onOpenTheatre={setTheatreMessageId}
                  onRegenerateCurrent={handleRegenerateCurrent}
                  onRegenerateWithModel={handleRegenerateWithModel}
                />
              );
            })}

            {isBusy && (() => {
              // Affiche une ligne « Réflexion… » tant qu'aucune part assistant
              // n'a été produite, OU si la dernière part assistant est vide
              // (le modèle a appelé un tool et attend son retour avant de
              // composer la réponse).
              const last = messages[messages.length - 1];
              const lastHasRenderableText =
                last?.role === "assistant" &&
                last.parts?.some(
                  (p) =>
                    p.type === "text" &&
                    typeof (p as { text?: string }).text === "string" &&
                    (p as { text: string }).text.trim().length > 0
                );
              if (lastHasRenderableText) return null;
              return <ThinkingIndicator />;
            })()}

            {error && (
              <ChatErrorBanner
                error={error}
                onRetry={() => {
                  regenerate({
                    body: {
                      providerKeyId,
                      conversationId,
                      documentIds: attachedDocIds,
                      modelOverride: modelId,
                      projectId: initialProjectId,
                      pipelineId,
                    },
                  });
                }}
              />
            )}

          </div>
        )}
        {/* Bouton flottant « Revenir en bas » — apparaît seulement quand
            l'utilisateur a scrollé vers le haut. Re-active le stick au clic. */}
        {!isStuck && !isEmpty && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="sticky bottom-4 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-md hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Revenir au bas de la conversation"
          >
            <IconArrowDown className="size-3.5" />
            Revenir en bas
          </button>
        )}
      </div>

      {/* Composer */}
      <div className="px-4 pb-4 md:px-6 md:pb-6">
        <div className="max-w-3xl mx-auto">
          {(uploadingCount > 0 || uploadError) && (
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              {uploadingCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                  <Spinner className="size-3" />
                  Téléversement de {uploadingCount} fichier
                  {uploadingCount > 1 ? "s" : ""}…
                </span>
              )}
              {uploadError && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/5 px-2 py-0.5 text-destructive">
                  <IconAlertTriangle className="size-3" />
                  {uploadError}
                  <button
                    type="button"
                    onClick={() => setUploadError(null)}
                    className="ml-1 rounded-sm hover:bg-destructive/10 p-0.5"
                    aria-label="Ignorer l'erreur"
                  >
                    <IconX className="size-3" />
                  </button>
                </span>
              )}
            </div>
          )}
          {attachedDocIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachedDocIds.map((id) => {
                const doc = mergedDocuments.find((d) => d.id === id);
                if (!doc) return null;
                return (
                  <Badge
                    key={id}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    <IconPaperclip className="size-3" />
                    <span className="max-w-[200px] truncate">
                      {doc.filename}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachedDocIds((ids) =>
                          ids.filter((x) => x !== id)
                        )
                      }
                      className="ml-0.5 rounded-sm hover:bg-background/50 p-0.5"
                      aria-label={`Retirer ${doc.filename}`}
                    >
                      <IconX className="size-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}

          {appliedSkills.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Compétences appliquées
              </span>
              {appliedSkills.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] text-foreground"
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          {selectedPipeline && (
            <div className="mb-3 flex justify-center">
              <LiveWorkflowPanel
                open={livePanelOpen}
                pipelineName={selectedPipeline.name}
                agents={liveAgents}
                round={councilRound?.current}
                totalRounds={councilRound?.total}
                onClose={() => setManuallyClosed(true)}
                onOpenTheatre={
                  lastAssistantId
                    ? () => setTheatreMessageId(lastAssistantId)
                    : undefined
                }
              />
            </div>
          )}

          {selectedPipeline && (
            <AgentTheatre
              open={theatreMessageId !== null}
              onOpenChange={(o) => {
                if (!o) setTheatreMessageId(null);
              }}
              pipelineName={selectedPipeline.name}
              turns={theatreTurns}
            />
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="rounded-2xl border border-input bg-card shadow-sm focus-within:ring-2 focus-within:ring-ring/40 transition-shadow"
          >
            <textarea
              ref={composerRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Posez votre question…"
              aria-label="Votre message à Louis"
              rows={1}
              disabled={isBusy}
              className="w-full resize-none rounded-t-2xl bg-transparent px-4 pt-3 pb-1 text-[15px] leading-[1.55] placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 max-h-[240px] overflow-y-auto"
            />

            <div className="flex items-center gap-1 px-2 pb-2 flex-wrap">
              {/* Menu unifié "+" inspiré du composer Claude — regroupe
                  joindre document, insérer workflow, switch pipeline et
                  accès rapide aux réglages. */}
              <ComposerMenu
                disabled={isBusy}
                onPickWorkflow={() => setWorkflowPickerOpen(true)}
                onPickWorkflowItem={(prompt) => setInput(prompt)}
                workflows={workflows}
                pipelines={pipelines.map((p) => ({
                  id: p.id,
                  name: p.name,
                  agentCount: p.agentCount,
                }))}
                currentPipelineId={pipelineId}
                onPipelineChange={(v) => setPipelineId(v)}
              />

              {/* Input fichier caché — déclenché par « Téléverser » du trombone. */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) handleDroppedFiles(files);
                  e.target.value = "";
                }}
              />

              {/* Trombone : joindre un document. Ancré sur un VRAI bouton
                  (et non un trigger caché) — corrige le bug de fermeture
                  immédiate du picker. Menu : téléverser depuis l'ordinateur
                  OU piocher dans les documents existants de Louis (RAG). */}
              <Popover open={docPickerOpen} onOpenChange={setDocPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={isBusy}
                    aria-label="Joindre un document"
                    title="Joindre un document"
                    className="inline-flex items-center justify-center size-10 rounded-md hover:bg-accent transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                  >
                    <IconPaperclip className="size-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-80 p-0">
                  <div className="p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDocPickerOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-accent text-sm text-left transition-colors"
                    >
                      <IconUpload className="size-4 text-muted-foreground" />
                      Téléverser depuis l&apos;ordinateur
                    </button>
                  </div>
                  {mergedDocuments.length > 0 && (
                    <div className="border-t border-border">
                      <DocPickerContent
                        documents={mergedDocuments}
                        folders={folders}
                        selected={attachedDocIds}
                        onToggle={(id) =>
                          setAttachedDocIds((ids) =>
                            ids.includes(id)
                              ? ids.filter((x) => x !== id)
                              : [...ids, id]
                          )
                        }
                      />
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              <Popover
                open={workflowPickerOpen}
                onOpenChange={setWorkflowPickerOpen}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="sr-only"
                    aria-hidden
                    tabIndex={-1}
                  />
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="start"
                  className="w-96 p-0"
                >
                  <WorkflowPickerContent
                    workflows={workflows}
                    onPick={(prompt) => {
                      setInput(prompt);
                      setWorkflowPickerOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>

              <ModelPicker
                value={selectedModelValue}
                onChange={handleModelChange}
                models={modelOptions}
                activeProviderTypes={
                  new Set(providerKeys.map((k) => k.type))
                }
                disabled={isBusy}
              />

              {/* Coût de la conversation + souveraineté du modèle — déplacés
                  ici depuis l'ex top-header (immersion). Groupés avec le
                  sélecteur de modèle car ils s'y rapportent ; l'action
                  d'envoi reste seule à droite (ml-auto). */}
              {(usage.inputTokens > 0 || usage.outputTokens > 0) &&
                (() => {
                  const cost = computeCost(
                    modelId,
                    usage.inputTokens,
                    usage.outputTokens
                  );
                  return (
                    <Popover>
                      <PopoverTrigger
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums hover:bg-accent hover:text-foreground transition-colors"
                        aria-label="Détails d'usage de la conversation"
                      >
                        {cost
                          ? formatCost(cost)
                          : `${formatTokens(usage.inputTokens + usage.outputTokens)} tokens`}
                      </PopoverTrigger>
                      <PopoverContent side="top" align="start" className="w-64 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                          Usage de la conversation
                        </p>
                        <dl className="space-y-1.5 text-xs">
                          <div className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">Tokens entrée</dt>
                            <dd className="tabular-nums">
                              {usage.inputTokens.toLocaleString("fr-FR")}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">Tokens sortie</dt>
                            <dd className="tabular-nums">
                              {usage.outputTokens.toLocaleString("fr-FR")}
                            </dd>
                          </div>
                          {cost && (
                            <div className="flex justify-between gap-3 pt-1.5 border-t border-border">
                              <dt className="font-medium">Coût estimé</dt>
                              <dd className="tabular-nums font-medium">
                                {formatCost(cost)}
                              </dd>
                            </div>
                          )}
                        </dl>
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          Tarifs publics du provider — facturation réelle peut
                          varier.
                        </p>
                      </PopoverContent>
                    </Popover>
                  );
                })()}

              <Badge
                variant={
                  selectedMeta.sovereignty === "fr"
                    ? "default"
                    : selectedMeta.sovereignty === "eu"
                      ? "secondary"
                      : "outline"
                }
                className="text-[10px]"
                title="Souveraineté du modèle"
              >
                {SOVEREIGNTY_LABEL[selectedMeta.sovereignty]}
              </Badge>

              <div className="ml-auto">
                {isBusy ? (
                  <button
                    type="button"
                    onClick={() => stop()}
                    className="inline-flex items-center justify-center size-11 rounded-full bg-foreground text-background hover:opacity-90 active:scale-95 transition-[opacity,transform] duration-150"
                    aria-label="Arrêter"
                  >
                    <IconPlayerStop className="size-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="inline-flex items-center justify-center size-11 rounded-full bg-primary text-primary-foreground hover:opacity-90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 transition-[opacity,transform] duration-150"
                    aria-label="Envoyer"
                  >
                    <IconArrowUp className="size-5" />
                  </button>
                )}
              </div>
            </div>
          </form>

          {estimatedCalls > 1 && (
            <p className="mt-2 text-[11px] text-muted-foreground text-center tabular-nums">
              {selectedPipeline?.name} : ~{estimatedCalls} appels IA par question
              {estimatedRunCost
                ? ` · ~${formatCost(estimatedRunCost)} estimé`
                : modelId
                  ? " · coût non tarifé pour ce modèle"
                  : ""}
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground text-center">
            Louis n&apos;est pas un avocat. Vérifiez le badge de souveraineté
            avant d&apos;envoyer des données sensibles.
          </p>
        </div>
      </div>
    </div>
    {mounted && openDoc && (
      <DocPanel
        key={`${openDoc.documentId}::${openDoc.targetText.slice(0, 32)}`}
        documentId={openDoc.documentId}
        targetText={openDoc.targetText}
        closing={docClosing}
        onClose={closeDoc}
        onReplace={(id) => setOpenDoc({ documentId: id, targetText: "" })}
      />
    )}
    </Dropzone>
  );
}

const EMPTY_SUGGESTIONS = [
  "Rédige une mise en demeure pour loyers impayés.",
  "Cherche la jurisprudence récente sur la clause de non-concurrence.",
  "Résume les points clés d'une décision de justice.",
  "Explique le régime de la responsabilité civile (art. 1240 C. civ.).",
];

function EmptyState({
  onPickSuggestion,
}: {
  onPickSuggestion: (text: string) => void;
}) {
  // Stagger d'entrée subtile : logo, titre, puis les suggestions l'une après
  // l'autre. Wrappé sous `motion-safe` (respecte prefers-reduced-motion).
  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl w-full">
        <LouisLogo className="size-10 text-primary mb-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500" />
        <div className="flex items-center gap-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-700">
          <h1 className="font-heading text-4xl md:text-5xl tracking-tight">
            Une nouvelle conversation.
          </h1>
          <ModuleHelp slug="user/chat" title="Utiliser le chat">
            Posez une question, joignez une pièce (trombone) ou laissez Louis
            chercher dans le droit (Légifrance, Pappers) et vos documents. Il
            peut aussi rédiger des actes en .docx. Chaque appel d&apos;outil est
            inspectable.
          </ModuleHelp>
        </div>
        <p className="mt-3 text-base text-muted-foreground motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-700 motion-safe:delay-150">
          Posez une question juridique, joignez une pièce, ou partez d&apos;un
          exemple.
        </p>

        <div className="mt-8 grid sm:grid-cols-2 gap-2.5">
          {EMPTY_SUGGESTIONS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => onPickSuggestion(s)}
              className="group text-left rounded-xl border border-border bg-card/40 hover:bg-accent/50 px-4 py-3 transition-colors motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-500"
              style={{
                animationDelay: `${260 + i * 70}ms`,
                animationFillMode: "both",
              }}
            >
              <span className="flex items-start gap-2">
                <span className="flex-1 text-sm text-foreground/90">{s}</span>
                <IconArrowUpRight className="size-4 shrink-0 mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
            </button>
          ))}
        </div>

        <p
          className="mt-6 text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-700"
          style={{ animationDelay: "560ms", animationFillMode: "both" }}
        >
          <span className="inline-flex items-center gap-1">
            <IconPaperclip className="size-3.5" /> joindre une pièce ou un
            document de Louis
          </span>
          <span aria-hidden>·</span>
          <span>
            <strong className="text-foreground/80">+</strong> trames, board
            multi-agents et réglages
          </span>
          <span aria-hidden>·</span>
          <span>badge FR / UE / US = souveraineté du modèle</span>
        </p>
      </div>
    </div>
  );
}

