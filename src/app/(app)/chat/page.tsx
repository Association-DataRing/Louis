import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { conversations, documents, messages, providerKeys } from "@/db/schema";
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
  const userName = session.user.name;

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
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
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
        inputTokens: messages.inputTokens,
        outputTokens: messages.outputTokens,
      })
      .from(messages)
      .where(eq(messages.conversationId, currentId))
      .orderBy(messages.createdAt);
    initialMessages = rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
    }));
    totalInputTokens = rows.reduce((n, r) => n + (r.inputTokens ?? 0), 0);
    totalOutputTokens = rows.reduce((n, r) => n + (r.outputTokens ?? 0), 0);
  }

  // key=currentId force le re-mount de ChatShell quand l'utilisateur change
  // de conversation via la sidebar (navigation soft Next sinon ne ré-init pas
  // le state interne de useChat).
  return (
    <ChatShell
      key={currentId ?? "new"}
      providerKeys={activeKeys}
      initialProviderKeyId={initialProviderKeyId}
      initialModelId={initialModelId}
      initialConversationId={currentId ?? null}
      initialMessages={initialMessages}
      availableDocuments={docList}
      initialUsage={{
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      }}
      userName={userName}
    />
  );
}

function NoProviderState() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8 md:px-8 md:py-10">
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
