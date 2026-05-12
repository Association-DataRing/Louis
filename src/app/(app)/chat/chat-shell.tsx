"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { IconSend2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  PROVIDER_CATALOG,
  SOVEREIGNTY_LABEL,
  type ProviderType,
} from "@/lib/providers/catalog";

type KeyOption = {
  id: string;
  label: string;
  type: ProviderType;
  isDefault: boolean;
};

type Props = {
  providerKeys: KeyOption[];
  initialProviderKeyId: string;
  initialConversationId: string | null;
  initialMessages: { id: string; role: string; content: string }[];
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

export function ChatShell({
  providerKeys,
  initialProviderKeyId,
  initialConversationId,
  initialMessages,
}: Props) {
  const router = useRouter();
  const [providerKeyId, setProviderKeyId] = useState(initialProviderKeyId);
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId
  );

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    []
  );

  const { messages, sendMessage, status, error } = useChat({
    messages: toUIMessages(initialMessages),
    transport,
    onFinish: ({ message }) => {
      const meta = message?.metadata as
        | { conversationId?: string }
        | undefined;
      if (meta?.conversationId) {
        setConversationId((prev) => {
          if (prev === meta.conversationId) return prev;
          const url = new URL(window.location.href);
          url.searchParams.set("id", meta.conversationId!);
          window.history.replaceState(null, "", url.toString());
          router.refresh();
          return meta.conversationId!;
        });
      }
    },
  });

  const [input, setInput] = useState("");
  const isBusy = status === "submitted" || status === "streaming";

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const selectedMeta = PROVIDER_CATALOG[
    providerKeys.find((k) => k.id === providerKeyId)?.type ?? "mistral"
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Provider :</span>
          <Select
            value={providerKeyId}
            onValueChange={(v) => setProviderKeyId(v)}
            disabled={isBusy}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providerKeys.map((k) => {
                const m = PROVIDER_CATALOG[k.type];
                return (
                  <SelectItem key={k.id} value={k.id}>
                    <span className="truncate">{k.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      · {m.label} · {SOVEREIGNTY_LABEL[m.sovereignty]}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
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
            const text = m.parts
              .filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join("");
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border"
                  }`}
                >
                  {text || <Spinner className="size-4" />}
                </div>
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
            { body: { providerKeyId, conversationId } }
          );
          setInput("");
        }}
        className="border-t border-border bg-background"
      >
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="relative">
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
              className="w-full resize-none rounded-md border border-input bg-card px-4 py-3 pr-12 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
