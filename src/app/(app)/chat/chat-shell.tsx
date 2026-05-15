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
};

function formatToolInput(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const obj = input as Record<string, unknown>;
  if (typeof obj.query === "string") return `« ${obj.query} »`;
  if (typeof obj.siren === "string") return `SIREN ${obj.siren}`;
  return "";
}

type SearchDocumentsHit = {
  documentId: string;
  filename: string;
  chunk: number;
  content: string;
  similarity: number;
};

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
    <div className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs flex items-center gap-2 max-w-[80%]">
      {isPending ? (
        <Spinner className="size-3" />
      ) : (
        <IconTool className="size-3 text-primary" />
      )}
      <span className="font-medium">{label}</span>
      {inputSummary && (
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
  // Panneau document à droite (citation cliquée dans search_documents)
  const [openDoc, setOpenDoc] = useState<{
    documentId: string;
    targetText: string;
  } | null>(null);

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
      <div className="flex-1 overflow-y-auto">
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
      <div className="text-center max-w-md">
        <LouisLogo className="size-10 text-primary mx-auto mb-6" />
        <h1 className="font-heading text-4xl font-light tracking-tight">
          Bonjour{firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-3 text-base text-muted-foreground font-heading font-light italic">
          Comment puis-je vous aider aujourd&apos;hui ?
        </p>
      </div>
    </div>
  );
}

