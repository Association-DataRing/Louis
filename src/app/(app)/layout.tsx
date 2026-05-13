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
    <div className="h-dvh bg-background flex flex-col md:flex-row overflow-hidden">
      <aside className="hidden md:flex shrink-0">
        <SidebarContent user={user} />
      </aside>
      <MobileNav user={user} />
      <main className="flex-1 min-w-0 min-h-0 overflow-y-auto md:overflow-hidden">
        {children}
      </main>
    </div>
  );
}
