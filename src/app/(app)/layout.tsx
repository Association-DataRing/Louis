import { redirect } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  conversations,
  documents,
  projects,
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

  const [convList, projectList, docList, workflowList] = await Promise.all([
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
  ]);

  return (
    <div className="h-dvh bg-background flex flex-col md:flex-row overflow-hidden">
      <aside className="hidden md:flex shrink-0">
        <SidebarContent
          user={user}
          conversations={convList}
          projects={projectList}
        />
      </aside>
      <MobileNav
        user={user}
        conversations={convList}
        projects={projectList}
      />
      <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">
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
