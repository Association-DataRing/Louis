import { redirect } from "next/navigation";
import { auth } from "@/auth";
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

  return (
    <div className="min-h-full flex flex-col md:flex-row">
      <aside className="hidden md:flex w-60 shrink-0 border-r border-sidebar-border">
        <SidebarContent user={user} />
      </aside>
      <MobileNav user={user} />
      <div className="flex-1 min-w-0 min-h-0">{children}</div>
    </div>
  );
}
