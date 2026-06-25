import { redirect } from "next/navigation";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  conversations,
  documents,
  modelSettings,
  projects,
  providerKeys,
  workflows,
} from "@/db/schema";
import { SidebarContent } from "./sidebar-content";
import { MobileNav } from "./mobile-nav";
import { CommandPalette } from "./command-palette";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = {
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
  };

  const [convList, projectList, docList, workflowList, providerCount, modelCount] = await Promise.all([
    db
      .select({
        id: conversations.id,
        title: conversations.title,
        projectId: conversations.projectId,
        pinnedAt: conversations.pinnedAt,
      })
      .from(conversations)
      .where(eq(conversations.userId, session.user.id))
      .orderBy(
        sql`${conversations.pinnedAt} desc nulls last`,
        desc(conversations.updatedAt)
      )
      .limit(50),
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.userId, session.user.id))
      .orderBy(asc(projects.name)),
    db
      .select({ id: documents.id, filename: documents.filename })
      .from(documents)
      .where(eq(documents.userId, session.user.id))
      .orderBy(desc(documents.createdAt))
      .limit(50),
    db
      .select({ id: workflows.id, name: workflows.name })
      .from(workflows)
      .where(eq(workflows.userId, session.user.id))
      .orderBy(asc(workflows.name)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(providerKeys)
      .where(
        and(
          eq(providerKeys.userId, session.user.id),
          eq(providerKeys.isActive, true)
        )
      )
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(modelSettings)
      .where(
        and(
          eq(modelSettings.userId, session.user.id),
          eq(modelSettings.enabled, true)
        )
      )
      .then((r) => r[0]?.n ?? 0),
  ]);

  // Parcours de prise en main affiché dans la sidebar tant qu'il n'est pas
  // complété. Document et conversation se déduisent des listes déjà chargées.
  const onboarding = {
    provider: providerCount > 0,
    model: modelCount > 0,
    document: docList.length > 0,
    conversation: convList.length > 0,
  };

  return (
    <div className="h-dvh bg-background flex flex-col md:flex-row overflow-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground focus:shadow-md"
      >
        Aller au contenu
      </a>
      <aside className="hidden md:flex shrink-0">
        <SidebarContent
          user={user}
          conversations={convList}
          projects={projectList}
          onboarding={onboarding}
        />
      </aside>
      <MobileNav
        user={user}
        conversations={convList}
        projects={projectList}
        onboarding={onboarding}
      />
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 min-w-0 min-h-0 overflow-y-auto outline-none"
      >
        {children}
      </main>
      <CommandPalette
        conversations={convList.map((c) => ({ id: c.id, label: c.title }))}
        projects={projectList.map((p) => ({ id: p.id, label: p.name }))}
        documents={docList.map((d) => ({ id: d.id, label: d.filename }))}
        workflows={workflowList.map((w) => ({ id: w.id, label: w.name }))}
        isAdmin={session.user.role === "admin"}
      />
    </div>
  );
}
