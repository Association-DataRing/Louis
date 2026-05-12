import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { IconPlus, IconMessageCircle } from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { conversations, documents, messages, providerKeys } from "@/db/schema";
import { isNotNull } from "drizzle-orm";
import { ChatShell } from "./chat-shell";

type Search = { id?: string };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const sp = await searchParams;
  const currentId = sp.id;

  const activeKeys = await db
    .select({
      id: providerKeys.id,
      label: providerKeys.label,
      type: providerKeys.type,
      isDefault: providerKeys.isDefault,
    })
    .from(providerKeys)
    .where(
      and(eq(providerKeys.userId, userId), eq(providerKeys.isActive, true))
    )
    .orderBy(desc(providerKeys.isDefault), desc(providerKeys.createdAt));

  if (activeKeys.length === 0) {
    return <NoProviderState />;
  }

  const convList = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(30);

  const docList = await db
    .select({
      id: documents.id,
      filename: documents.filename,
      sizeBytes: documents.sizeBytes,
    })
    .from(documents)
    .where(and(eq(documents.userId, userId), isNotNull(documents.extractedText)))
    .orderBy(desc(documents.createdAt))
    .limit(50);

  let initialMessages: { id: string; role: string; content: string }[] = [];
  let initialProviderKeyId = activeKeys[0].id;
  let initialModelId: string | null = null;
  if (currentId) {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(
        and(eq(conversations.id, currentId), eq(conversations.userId, userId))
      )
      .limit(1);
    if (!conv) redirect("/chat");
    if (conv.providerKeyId && activeKeys.some((k) => k.id === conv.providerKeyId)) {
      initialProviderKeyId = conv.providerKeyId;
    }
    initialModelId = conv.modelId;
    const rows = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
      })
      .from(messages)
      .where(eq(messages.conversationId, currentId))
      .orderBy(messages.createdAt);
    initialMessages = rows;
  }

  return (
    <div className="flex h-full">
      <aside className="w-72 shrink-0 border-r border-border bg-card/40 flex flex-col">
        <div className="p-3 border-b border-border">
          <Link
            href="/chat"
            className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <IconPlus className="size-4" />
            Nouvelle conversation
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {convList.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">
              Vos conversations apparaîtront ici.
            </p>
          ) : (
            convList.map((c) => {
              const isCurrent = c.id === currentId;
              return (
                <Link
                  key={c.id}
                  href={`/chat?id=${c.id}`}
                  className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
                    isCurrent
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/60"
                  }`}
                >
                  <IconMessageCircle className="size-3.5 shrink-0 opacity-60" />
                  <span className="truncate">{c.title}</span>
                </Link>
              );
            })
          )}
        </div>
      </aside>

      <ChatShell
        providerKeys={activeKeys}
        initialProviderKeyId={initialProviderKeyId}
        initialModelId={initialModelId}
        initialConversationId={currentId ?? null}
        initialMessages={initialMessages}
        availableDocuments={docList}
      />
    </div>
  );
}

function NoProviderState() {
  return (
    <main className="px-8 py-10 max-w-3xl">
      <h1 className="font-heading text-3xl tracking-tight">Conversations</h1>
      <div className="mt-6 border border-dashed border-border rounded-lg p-10 text-center">
        <h2 className="font-heading text-lg">Aucun provider actif</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          Ajoutez et activez au moins un provider IA pour commencer à
          discuter.
        </p>
        <Link
          href="/providers"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Configurer les providers
        </Link>
      </div>
    </main>
  );
}
