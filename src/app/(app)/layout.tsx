import { redirect } from "next/navigation";
import Link from "next/link";
import {
  IconLayoutDashboard,
  IconKey,
  IconPlugConnected,
  IconMessageCircle,
  IconFolder,
  IconSettings,
  IconLogout,
  IconBolt,
  IconShieldLock,
} from "@tabler/icons-react";
import { auth, signOut } from "@/auth";

const navItems = [
  { href: "/dashboard", label: "Tableau de bord", icon: IconLayoutDashboard },
  { href: "/chat", label: "Conversations", icon: IconMessageCircle },
  { href: "/documents", label: "Documents", icon: IconFolder },
  { href: "/providers", label: "Providers IA", icon: IconKey },
  { href: "/connectors", label: "Connecteurs", icon: IconPlugConnected },
  { href: "/mcp", label: "Serveurs MCP", icon: IconBolt },
  { href: "/settings", label: "Paramètres", icon: IconSettings },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-full flex">
      <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col">
        <Link href="/dashboard" className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
          <OakLogo className="size-5 text-sidebar-primary" />
          <span className="font-heading text-base tracking-tight">Louis</span>
        </Link>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-2.5 py-2 text-sm hover:bg-sidebar-accent transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </span>
              </Link>
            );
          })}
          {session.user.role === "admin" && (
            <Link
              href="/admin/users"
              className="block rounded-md px-2.5 py-2 text-sm hover:bg-sidebar-accent transition-colors mt-4 border-t border-sidebar-border pt-4"
            >
              <span className="flex items-center gap-2.5">
                <IconShieldLock className="size-4 shrink-0 text-sidebar-primary" />
                Administration
              </span>
            </Link>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-2">
          <div className="px-2.5 py-1.5 text-xs">
            <div className="font-medium truncate">{session.user.name}</div>
            <div className="text-sidebar-foreground/60 truncate">{session.user.email}</div>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-sidebar-accent transition-colors text-left"
            >
              <IconLogout className="size-4" />
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function OakLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 21V13" />
      <path d="M9 21h6" />
      <path d="M12 13c0-3 2-4 4-4 1.5 0 3-1 3-3 0-1.5-1-3-3-3-1.5 0-2.5 1-3 2-.5-1-1.5-2-3-2-2 0-3 1.5-3 3 0 2 1.5 3 3 3 2 0 4 1 4 4Z" />
    </svg>
  );
}
