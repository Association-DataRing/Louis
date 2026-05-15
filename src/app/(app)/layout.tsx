import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { conversations, projects } from "@/db/schema";
import { SidebarContent } from "./sidebar-content";
import { MobileNav } from "./mobile-nav";

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

  const [convList, projectList] = await Promise.all([
    db
      .select({
        id: conversations.id,
        title: conversations.title,
        projectId: conversations.projectId,
      })
      .from(conversations)
      .where(eq(conversations.userId, session.user.id))
      .orderBy(desc(conversations.updatedAt))
      .limit(50),
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.userId, session.user.id))
      .orderBy(asc(projects.name)),
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
    </div>
  );
}
