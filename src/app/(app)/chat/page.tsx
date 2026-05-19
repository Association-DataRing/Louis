import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  conversations,
  documents,
  messages,
  pipelineAgents,
  pipelines,
  projects,
  providerKeys,
  workflows,
} from "@/db/schema";
import { seedPresetsForUser } from "@/lib/orchestrator";
import { ChatShell } from "./chat-shell";

type Search = {
  id?: string;
  project?: string;
  pipeline?: string;
  prompt?: string;
};

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
  const projectIdFromUrl = sp.project ?? null;

  // Si l'URL contient ?project=X, on vérifie qu'il appartient bien à
  // l'utilisateur et on récupère son nom pour l'afficher en breadcrumb.
  let projectContext: { id: string; name: string } | null = null;
  if (projectIdFromUrl) {
    const [proj] = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(
        and(eq(projects.id, projectIdFromUrl), eq(projects.userId, userId))
      )
      .limit(1);
    if (proj) projectContext = proj;
  }

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

  // Garantit que l'utilisateur dispose au moins des pipelines presets,
  // semés à la volée si c'est sa première visite sur /chat ou /bureau.
  let pipelineRows = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.userId, userId))
    .orderBy(asc(pipelines.isPreset), asc(pipelines.name));

  if (pipelineRows.length === 0) {
    await seedPresetsForUser(userId);
    pipelineRows = await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.userId, userId))
      .orderBy(asc(pipelines.isPreset), asc(pipelines.name));
  }

  // Charge tous les agents en une requête puis regroupe — utile car la
  // panel live a besoin de connaître les agents de la pipeline sélectionnée
  // sans round-trip au moment du clic.
  const allAgents =
    pipelineRows.length > 0
      ? await db
          .select()
          .from(pipelineAgents)
          .orderBy(asc(pipelineAgents.position))
      : [];

  const pipelineList = pipelineRows.map((p) => {
    const agents = allAgents.filter((a) => a.pipelineId === p.id);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      isPreset: p.isPreset,
      agentCount: agents.length,
      agents: agents.map((a) => ({
        id: a.id,
        role: a.role,
        label: a.label,
      })),
    };
  });

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

  const workflowList = await db
    .select({
      id: workflows.id,
      name: workflows.name,
      description: workflows.description,
      prompt: workflows.prompt,
    })
    .from(workflows)
    .where(eq(workflows.userId, userId))
    .orderBy(asc(workflows.name));

  let initialMessages: {
    id: string;
    role: string;
    content: string;
    parts: import("@/db/schema").SavedPart[] | null;
  }[] = [];
  let initialProviderKeyId = activeKeys[0].id;
  let initialModelId: string | null = null;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  // Si on charge une conversation existante, on hérite de SON projectId pour
  // le breadcrumb. Sinon on prend celui de l'URL (?project=X).
  let conversationProjectContext = projectContext;
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
    if (conv.projectId) {
      const [p] = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(
          and(eq(projects.id, conv.projectId), eq(projects.userId, userId))
        )
        .limit(1);
      if (p) conversationProjectContext = p;
    }
    const rows = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        parts: messages.parts,
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
      parts: r.parts ?? null,
    }));
    totalInputTokens = rows.reduce((n, r) => n + (r.inputTokens ?? 0), 0);
    totalOutputTokens = rows.reduce((n, r) => n + (r.outputTokens ?? 0), 0);
  }

  // key=currentId force le re-mount de ChatShell quand l'utilisateur change
  // de conversation via la sidebar (navigation soft Next sinon ne ré-init pas
  // le state interne de useChat).
  return (
    <ChatShell
      key={currentId ?? `new-${projectIdFromUrl ?? ""}-${sp.pipeline ?? ""}-${sp.prompt ? "p" : ""}`}
      providerKeys={activeKeys}
      initialProviderKeyId={initialProviderKeyId}
      initialModelId={initialModelId}
      initialConversationId={currentId ?? null}
      initialProjectId={
        currentId ? null : projectContext?.id ?? null
      }
      initialPipelineId={
        currentId ? null : sp.pipeline ?? null
      }
      initialPrompt={currentId ? null : sp.prompt ?? null}
      projectContext={conversationProjectContext}
      initialMessages={initialMessages}
      availableDocuments={docList}
      workflows={workflowList}
      pipelines={pipelineList}
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
