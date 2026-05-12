"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { IconSend2, IconPaperclip, IconX, IconTool } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
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

type Props = {
  providerKeys: KeyOption[];
  initialProviderKeyId: string;
  initialModelId: string | null;
  initialConversationId: string | null;
  initialMessages: { id: string; role: string; content: string }[];
  availableDocuments: DocumentOption[];
  initialUsage: Usage;
};

function toUIMessages(
  rows: Props["initialMessages"]
): UIMessage[] {
  return rows.map((m) => ({
    id: m.id,
    role: m.role as UIMessage["role"],
    parts: [{ type: "text", text: m.content }],
  }));
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  return `${(n / 1000).toFixed(1)}k`;
}

function ToolPart({
  name,
  input,
  state,
}: {
  name: string;
  input?: unknown;
  output?: unknown;
  state?: string;
}) {
  const label = TOOL_LABEL[name] ?? name;
  const inputSummary = formatToolInput(input);
  const isPending = state === "input-streaming" || state === "input-available";
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs flex items-center gap-2 max-w-[85%]">
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
  initialMessages,
  availableDocuments,
  initialUsage,
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

  function handleProviderChange(nextId: string) {
    setProviderKeyId(nextId);
    const nextType = providerKeys.find((k) => k.id === nextId)?.type;
    if (nextType) setModelId(DEFAULT_MODEL[nextType]);
  }

  const selectedKey = providerKeys.find((k) => k.id === providerKeyId);
  const selectedType: ProviderType = selectedKey?.type ?? "mistral";
  const modelOptions = MODEL_CATALOG[selectedType];

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    []
  );

  const { messages, sendMessage, status, error } = useChat({
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

  // Sync URL + refresh server-rendered sidebar when conversationId changes.
  // Skips the initial mount (URL already matches the SSR id) and is fully
  // imperative — no setState here, so React doesn't complain about cascading
  // renders.
  useEffect(() => {
    if (!conversationId) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("id") === conversationId) return;
    url.searchParams.set("id", conversationId);
    window.history.replaceState(null, "", url.toString());
    router.refresh();
  }, [conversationId, router]);

  const [input, setInput] = useState("");
  const isBusy = status === "submitted" || status === "streaming";

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const selectedMeta = PROVIDER_CATALOG[selectedType];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="border-b border-border px-6 py-3 flex items-center gap-3 flex-wrap text-sm">
        <span className="text-muted-foreground">Provider</span>
        <Select
          value={providerKeyId}
          onValueChange={handleProviderChange}
          disabled={isBusy}
        >
          <SelectTrigger className="w-[220px]">
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

        <span className="text-muted-foreground">Modèle</span>
        <Select
          value={modelId}
          onValueChange={(v) => setModelId(v)}
          disabled={isBusy}
        >
          <SelectTrigger className="w-[220px]">
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

        <div className="ml-auto flex items-center gap-2">
          {(usage.inputTokens > 0 || usage.outputTokens > 0) && (
            <span
              className="text-[10px] text-muted-foreground tabular-nums"
              title={`${usage.inputTokens} tokens entrée, ${usage.outputTokens} tokens sortie`}
            >
              {formatTokens(usage.inputTokens)}↗ {formatTokens(usage.outputTokens)}↘
            </span>
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

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-20">
              <p className="font-heading text-lg text-foreground">
                Bonjour. Posez votre question.
              </p>
              <p className="mt-2 text-sm">
                Louis n&apos;est pas un avocat. Vérifiez toujours les
                réponses sur une source officielle.
              </p>
            </div>
          )}

          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={`flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}
              >
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <div
                        key={i}
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          isUser
                            ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                            : "bg-card border border-border prose prose-sm prose-neutral dark:prose-invert max-w-none prose-pre:my-2 prose-headings:font-heading prose-headings:tracking-tight prose-p:my-1.5 prose-ul:my-2 prose-li:my-0.5"
                        }`}
                      >
                        {part.text ? (
                          isUser ? (
                            part.text
                          ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {part.text}
                            </ReactMarkdown>
                          )
                        ) : (
                          <Spinner className="size-4" />
                        )}
                      </div>
                    );
                  }
                  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
                    const p = part as { type: string; input?: unknown; output?: unknown; state?: string };
                    return (
                      <ToolPart
                        key={i}
                        name={part.type.replace(/^tool-/, "")}
                        input={p.input}
                        output={p.output}
                        state={p.state}
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
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
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
              },
            }
          );
          setInput("");
        }}
        className="border-t border-border bg-background"
      >
        <div className="max-w-3xl mx-auto px-6 py-4">
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
                    <span className="max-w-[200px] truncate">{doc.filename}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachedDocIds((ids) => ids.filter((x) => x !== id))
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
          <div className="relative">
            <Popover open={docPickerOpen} onOpenChange={setDocPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={isBusy}
                  className="absolute bottom-2 left-2 inline-flex items-center justify-center size-8 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
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
              className="w-full resize-none rounded-md border border-input bg-card pl-12 pr-12 py-3 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isBusy || !input.trim()}
              className="absolute bottom-2 right-2"
              aria-label="Envoyer"
            >
              {isBusy ? <Spinner className="size-4" /> : <IconSend2 className="size-4" />}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground text-center">
            Modèles IA hébergés par vos providers — vérifiez le badge de souveraineté
            avant d&apos;envoyer des données sensibles.
          </p>
        </div>
      </form>
    </div>
  );
}
