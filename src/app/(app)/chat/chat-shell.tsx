"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LouisLogo } from "@/components/louis-logo";
import { uiPartsFromSaved } from "@/lib/ai/saved-parts";
import type { SavedPart } from "@/db/schema/messages";
import { DocPanel } from "./doc-panel";
import { EditCard } from "./edit-card";
import {
  IconArrowUp,
  IconPaperclip,
  IconX,
  IconTool,
  IconPlayerStop,
  IconFileText,
  IconSparkles,
  IconLibrary,
  IconDownload,
  IconFileTypePdf,
  IconFileTypeDocx,
  IconAlertTriangle,
  IconPencil,
} from "@tabler/icons-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type Props = {
  providerKeys: KeyOption[];
  initialProviderKeyId: string;
  initialModelId: string | null;
  initialConversationId: string | null;
  initialProjectId: string | null;
  projectContext: { id: string; name: string } | null;
  initialMessages: {
    id: string;
    role: string;
    content: string;
    parts: SavedPart[] | null;
  }[];
  availableDocuments: DocumentOption[];
  workflows: WorkflowOption[];
  initialUsage: Usage;
  userName: string;
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
    const pattern = new RegExp(`(?<!\\]\\()(${escapeRegex(d.filename)})(?!\\))`, "g");
    out = out.replace(pattern, `[$1](louis-doc:${d.id})`);
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

/**
 * L'AI SDK v6 emballe la sortie d'un tool dans `{type: "json", value: {...}}`
 * (ou `{type: "text", text: "..."}` pour les retours scalaires). Notre tool
 * renvoie ensuite une envelope ToolResult `{ok: true, data: {...}}`. On
 * unwrap successivement ces couches pour récupérer la `data` métier.
 *
 * Cas gérés :
 *   - { type: "json", value: { ok: true, data: T } }   ← AI SDK + ToolResult
 *   - { type: "text", text: "<json>" }                  ← AI SDK provider-executed
 *   - { ok: true, data: T }                             ← envelope brute
 *   - T                                                 ← objet déjà dépouillé
 *   - "<json>"                                          ← string serialisée
 */
function unwrapToolResult<T>(o: unknown): T | null {
  if (!o) return null;
  let candidate: unknown = o;

  // Couche 1 : si string, parse en JSON
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  if (typeof candidate !== "object" || candidate === null) return null;

  // Couche 2 : enveloppe AI SDK {type, value/text}
  const aiObj = candidate as Record<string, unknown>;
  if ("type" in aiObj && "value" in aiObj && aiObj.type === "json") {
    candidate = aiObj.value;
  } else if ("type" in aiObj && "text" in aiObj && aiObj.type === "text") {
    try {
      candidate = JSON.parse(String(aiObj.text));
    } catch {
      return null;
    }
  }
  if (typeof candidate !== "object" || candidate === null) return null;

  // Couche 3 : envelope ToolResult {ok, data}
  const env = candidate as Record<string, unknown>;
  if ("ok" in env && "data" in env) {
    if (env.ok === false) return null;
    return env.data as T;
  }

  return env as T;
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
    <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 max-w-[85%] flex items-center gap-3">
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
          Cliquez pour prévisualiser
        </p>
      </button>
      <a
        href={`/api/documents/${documentId}/file?download=1`}
        download={filename}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
      >
        <IconDownload className="size-3.5" />
        Télécharger
      </a>
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
    <div className="rounded-lg border border-border bg-card overflow-hidden max-w-[85%]">
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
                  <p className="text-[9px] uppercase tracking-wider text-destructive/70 font-semibold mb-0.5">
                    Avant
                  </p>
                  <p className="font-mono text-foreground/80 line-through decoration-destructive/40">
                    {edit.find}
                  </p>
                </div>
                <div className="bg-primary/5 border border-primary/15 rounded px-2 py-1.5">
                  <p className="text-[9px] uppercase tracking-wider text-primary font-semibold mb-0.5">
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

  return (
    <div
      className={`relative overflow-hidden rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs flex items-center gap-2 max-w-[80%] ${
        isPending ? "shimmer" : ""
      }`}
    >
      {isPending ? (
        <Spinner className="size-3" />
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
        <p className="text-xs font-medium">Workflows</p>
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

function DocPickerContent({
  documents,
  selected,
  onToggle,
}: {
  documents: DocumentOption[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
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
  return (
    <div className="max-h-72 overflow-y-auto py-1">
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs font-medium">Joindre au prompt</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Le texte extrait sera inséré dans le system prompt.
        </p>
      </div>
      {documents.map((doc) => {
        const isSelected = selected.includes(doc.id);
        return (
          <label
            key={doc.id}
            className="flex items-center gap-2.5 px-3 py-2 hover:bg-accent cursor-pointer"
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggle(doc.id)}
            />
            <span className="flex-1 text-sm truncate">{doc.filename}</span>
          </label>
        );
      })}
    </div>
  );
}

export function ChatShell({
  providerKeys,
  initialProviderKeyId,
  initialModelId,
  initialConversationId,
  initialProjectId,
  projectContext,
  initialMessages,
  availableDocuments,
  workflows,
  initialUsage,
  userName,
}: Props) {
  const router = useRouter();
  const [providerKeyId, setProviderKeyId] = useState(initialProviderKeyId);
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
  // Panneau document à droite (citation cliquée OU document auto-ouvert
  // après generate/edit_document). Persisté en sessionStorage pour survivre
  // au remount qui se produit quand l'URL passe de /chat à /chat?id=xxx via
  // la key=currentId du parent.
  const [openDoc, setOpenDocState] = useState<{
    documentId: string;
    targetText: string;
  } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage.getItem("louis:openDoc");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const setOpenDoc = (
    next: { documentId: string; targetText: string } | null
  ) => {
    setOpenDocState(next);
    if (typeof window === "undefined") return;
    try {
      if (next) {
        window.sessionStorage.setItem("louis:openDoc", JSON.stringify(next));
      } else {
        window.sessionStorage.removeItem("louis:openDoc");
      }
    } catch {}
  };
  // Tracking des document_id déjà auto-ouverts dans le DocPanel pour ne
  // pas réouvrir à chaque re-render. Survit au remount qui se produit
  // quand l'URL passe de /chat à /chat?id=xxx via sessionStorage.
  const lastAutoOpenedDocId = useRef<string | null>(
    typeof window !== "undefined"
      ? window.sessionStorage.getItem("louis:lastAutoOpenedDoc")
      : null
  );

  function handleProviderChange(nextId: string) {
    setProviderKeyId(nextId);
    const nextType = providerKeys.find((k) => k.id === nextId)?.type;
    if (nextType) setModelId(DEFAULT_MODEL[nextType]);
  }

  const selectedKey = providerKeys.find((k) => k.id === providerKeyId);
  const selectedType: ProviderType = selectedKey?.type ?? "mistral";
  const modelOptions = MODEL_CATALOG[selectedType];
  const selectedMeta = PROVIDER_CATALOG[selectedType];

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    []
  );

  const { messages, sendMessage, status, error, stop } = useChat({
    messages: toUIMessages(initialMessages),
    transport,
    onFinish: ({ message }) => {
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

  const [input, setInput] = useState("");
  const isBusy = status === "submitted" || status === "streaming";
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || isBusy) return;
    sendMessage(
      { text: trimmed },
      {
        body: {
          providerKeyId,
          conversationId,
          documentIds: attachedDocIds,
          modelOverride: modelId,
          projectId: initialProjectId,
        },
      }
    );
    setInput("");
  }

  const isEmpty = messages.length === 0;

  // Auto-ouverture du DocPanel dès qu'un tool generate_document /
  // edit_document termine avec un document_id. On scanne les parts du
  // dernier message assistant et on prend le plus récent non vu.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || !last.parts) return;
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
  }, [messages]);

  return (
    <div className="flex-1 flex h-full min-w-0 w-full">
    <div className="flex-1 flex flex-col h-full min-w-0 bg-background">
      {/* Top header — light, breadcrumb project + usage + sovereignty */}
      <header className="border-b border-border px-6 py-3 flex items-center gap-3 text-xs h-[52px]">
        {projectContext && (
          <Link
            href={`/projects/${projectContext.id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Voir le projet"
          >
            <span className="size-1.5 rounded-full bg-primary" />
            <span className="truncate max-w-[200px]">{projectContext.name}</span>
          </Link>
        )}
        <div className="ml-auto flex items-center gap-3">
        {(usage.inputTokens > 0 || usage.outputTokens > 0) && (
          <>
            <span
              className="text-muted-foreground tabular-nums"
              title={`${usage.inputTokens} tokens entrée, ${usage.outputTokens} tokens sortie`}
            >
              {formatTokens(usage.inputTokens)}↗ {formatTokens(usage.outputTokens)}↘
            </span>
            {(() => {
              const cost = computeCost(
                modelId,
                usage.inputTokens,
                usage.outputTokens
              );
              if (!cost) return null;
              return (
                <span
                  className="text-muted-foreground tabular-nums"
                  title="Coût estimé selon les tarifs publics du provider"
                >
                  {formatCost(cost)}
                </span>
              );
            })()}
          </>
        )}
        <Badge
          variant={
            selectedMeta.sovereignty === "fr"
              ? "default"
              : selectedMeta.sovereignty === "eu"
                ? "secondary"
                : "outline"
          }
          className="text-[10px]"
        >
          {SOVEREIGNTY_LABEL[selectedMeta.sovereignty]}
        </Badge>
        </div>
      </header>

      {/* Messages or empty state */}
      <div
        className="flex-1 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-busy={isBusy}
        aria-label="Conversation avec Louis"
      >
        {isEmpty ? (
          <EmptyState userName={userName} />
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}
                >
                  {m.parts.map((part, i) => {
                    if (part.type === "text") {
                      if (isUser) {
                        return (
                          <div
                            key={i}
                            className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-secondary text-foreground"
                          >
                            {part.text}
                          </div>
                        );
                      }
                      return (
                        <div
                          key={i}
                          className="w-full text-sm leading-relaxed prose prose-sm prose-neutral dark:prose-invert max-w-none prose-pre:my-2 prose-headings:font-heading prose-headings:tracking-tight prose-p:my-1.5 prose-ul:my-2 prose-li:my-0.5"
                        >
                          {part.text ? (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code: ({ className, children, ...rest }) => {
                                  const lang =
                                    (className ?? "").match(/language-(\w+)/)?.[1];
                                  if (lang === "edit") {
                                    return (
                                      <EditCard
                                        raw={String(children).replace(/\n$/, "")}
                                      />
                                    );
                                  }
                                  return (
                                    <code className={className} {...rest}>
                                      {children}
                                    </code>
                                  );
                                },
                                a: ({ href, children, ...rest }) => {
                                  if (
                                    typeof href === "string" &&
                                    href.startsWith("louis-doc:")
                                  ) {
                                    const docId = href.slice("louis-doc:".length);
                                    return (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setOpenDoc({
                                            documentId: docId,
                                            targetText: "",
                                          })
                                        }
                                        className="inline-flex items-center gap-1 rounded bg-muted hover:bg-accent px-1.5 py-0.5 text-[0.85em] font-medium not-prose transition-colors no-underline align-baseline"
                                      >
                                        <IconFileText className="size-3 shrink-0" />
                                        {children}
                                      </button>
                                    );
                                  }
                                  return (
                                    <a {...rest} href={href}>
                                      {children}
                                    </a>
                                  );
                                },
                              }}
                            >
                              {linkifyDocMentions(part.text, availableDocuments)}
                            </ReactMarkdown>
                          ) : (
                            <Spinner className="size-4" />
                          )}
                        </div>
                      );
                    }
                    if (
                      typeof part.type === "string" &&
                      part.type.startsWith("tool-")
                    ) {
                      const p = part as {
                        type: string;
                        input?: unknown;
                        output?: unknown;
                        state?: string;
                      };
                      return (
                        <ToolPart
                          key={i}
                          name={part.type.replace(/^tool-/, "")}
                          input={p.input}
                          output={p.output}
                          state={p.state}
                          onOpenDoc={(documentId, targetText) =>
                            setOpenDoc({ documentId, targetText })
                          }
                        />
                      );
                    }
                    return null;
                  })}
                </div>
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
              return (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <LouisLogo className="size-4 text-primary mt-0.5 shrink-0" />
                  <span className="shimmer relative overflow-hidden rounded-md bg-muted/40 px-3 py-1.5 text-xs font-medium">
                    Réflexion en cours…
                  </span>
                </div>
              );
            })()}

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">
                Une erreur est survenue : {error.message}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="px-4 pb-4 md:px-6 md:pb-6">
        <div className="max-w-3xl mx-auto">
          {attachedDocIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachedDocIds.map((id) => {
                const doc = availableDocuments.find((d) => d.id === id);
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

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="rounded-2xl border border-input bg-card shadow-sm focus-within:ring-2 focus-within:ring-ring/40 transition-shadow"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Posez votre question…"
              rows={2}
              disabled={isBusy}
              className="w-full resize-none rounded-t-2xl bg-transparent px-4 pt-3 pb-1 text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />

            <div className="flex items-center gap-1 px-2 pb-2 flex-wrap">
              <Popover open={docPickerOpen} onOpenChange={setDocPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={isBusy}
                    className="inline-flex items-center justify-center size-10 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                    aria-label="Joindre des documents"
                  >
                    <IconPaperclip className="size-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="start"
                  className="w-80 p-0"
                >
                  <DocPickerContent
                    documents={availableDocuments}
                    selected={attachedDocIds}
                    onToggle={(id) =>
                      setAttachedDocIds((ids) =>
                        ids.includes(id)
                          ? ids.filter((x) => x !== id)
                          : [...ids, id]
                      )
                    }
                  />
                </PopoverContent>
              </Popover>

              <Popover
                open={workflowPickerOpen}
                onOpenChange={setWorkflowPickerOpen}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={isBusy}
                    className="inline-flex items-center justify-center size-10 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                    aria-label="Insérer un workflow"
                    title="Workflows"
                  >
                    <IconSparkles className="size-4" />
                  </button>
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

              <Select
                value={providerKeyId}
                onValueChange={handleProviderChange}
                disabled={isBusy}
              >
                <SelectTrigger
                  size="sm"
                  className="h-8 border-0 bg-transparent shadow-none hover:bg-accent text-xs px-2 gap-1.5"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerKeys.map((k) => {
                    const m = PROVIDER_CATALOG[k.type];
                    return (
                      <SelectItem key={k.id} value={k.id}>
                        <span className="truncate">{k.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          · {SOVEREIGNTY_LABEL[m.sovereignty]}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Select
                value={modelId}
                onValueChange={(v) => setModelId(v)}
                disabled={isBusy}
              >
                <SelectTrigger
                  size="sm"
                  className="h-8 border-0 bg-transparent shadow-none hover:bg-accent text-xs px-2 gap-1.5"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span>{m.label}</span>
                      {m.hint && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          · {m.hint}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="ml-auto">
                {isBusy ? (
                  <button
                    type="button"
                    onClick={() => stop()}
                    className="inline-flex items-center justify-center size-11 rounded-full bg-foreground text-background hover:opacity-90 transition-opacity"
                    aria-label="Arrêter"
                  >
                    <IconPlayerStop className="size-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="inline-flex items-center justify-center size-11 rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                    aria-label="Envoyer"
                  >
                    <IconArrowUp className="size-5" />
                  </button>
                )}
              </div>
            </div>
          </form>

          <p className="mt-2 text-[11px] text-muted-foreground text-center">
            Louis n&apos;est pas un avocat. Vérifiez le badge de souveraineté
            avant d&apos;envoyer des données sensibles.
          </p>
        </div>
      </div>
    </div>
    {openDoc && (
      <DocPanel
        key={`${openDoc.documentId}::${openDoc.targetText.slice(0, 32)}`}
        documentId={openDoc.documentId}
        targetText={openDoc.targetText}
        onClose={() => setOpenDoc(null)}
      />
    )}
    </div>
  );
}

function EmptyState({ userName }: { userName: string }) {
  const firstName = userName.split(/[\s.]/)[0] || "";
  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      <div className="max-w-xl w-full">
        <LouisLogo className="size-10 text-primary mb-6" />
        <h1 className="font-heading text-4xl md:text-5xl tracking-tight">
          Bonjour{firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Quelques pistes pour démarrer — ou tapez directement votre
          question dans le composer ci-dessous.
        </p>
        <ul className="mt-8 space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="text-muted-foreground tabular-nums">·</span>
            <span>
              <strong className="text-foreground">Joindre un document</strong>
              <span className="text-muted-foreground">
                {" "}
                — cliquez sur l&apos;icône trombone pour interroger un PDF
                ou un DOCX que vous avez importé.
              </span>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground tabular-nums">·</span>
            <span>
              <strong className="text-foreground">Insérer un workflow</strong>
              <span className="text-muted-foreground">
                {" "}
                — icône étoiles pour piquer un prompt prêt à l&apos;emploi
                (résumé d&apos;arrêt, analyse de clause…).
              </span>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted-foreground tabular-nums">·</span>
            <span>
              <strong className="text-foreground">Choisir un modèle</strong>
              <span className="text-muted-foreground">
                {" "}
                — sélecteur en bas à gauche, le badge FR / UE / US reste
                visible pendant toute la conversation.
              </span>
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

