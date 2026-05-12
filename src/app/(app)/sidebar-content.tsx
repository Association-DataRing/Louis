"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { signOutAction } from "@/auth/actions";

const navItems = [
  { href: "/dashboard", label: "Tableau de bord", icon: IconLayoutDashboard },
  { href: "/chat", label: "Conversations", icon: IconMessageCircle },
  { href: "/documents", label: "Documents", icon: IconFolder },
  { href: "/providers", label: "Providers IA", icon: IconKey },
  { href: "/connectors", label: "Connecteurs", icon: IconPlugConnected },
  { href: "/mcp", label: "Serveurs MCP", icon: IconBolt },
  { href: "/settings", label: "Paramètres", icon: IconSettings },
];

type Props = {
  user: { name: string; email: string; role: string };
  onNavigate?: () => void;
};

export function SidebarContent({ user, onNavigate }: Props) {
  const pathname = usePathname();

  return (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border"
      >
        <OakLogo className="size-5 text-sidebar-primary" />
        <span className="font-heading text-base tracking-tight">Louis</span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`block rounded-md px-2.5 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="size-4 shrink-0" />
                {item.label}
              </span>
            </Link>
          );
        })}

        {user.role === "admin" && (
          <Link
            href="/admin/users"
            onClick={onNavigate}
            className={`block rounded-md px-2.5 py-2 text-sm transition-colors mt-4 border-t border-sidebar-border pt-4 ${
              pathname.startsWith("/admin")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent"
            }`}
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
          <div className="font-medium truncate">{user.name}</div>
          <div className="text-sidebar-foreground/60 truncate">{user.email}</div>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-sidebar-accent transition-colors text-left"
          >
            <IconLogout className="size-4" />
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}

function OakLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 21V13" />
      <path d="M9 21h6" />
      <path d="M12 13c0-3 2-4 4-4 1.5 0 3-1 3-3 0-1.5-1-3-3-3-1.5 0-2.5 1-3 2-.5-1-1.5-2-3-2-2 0-3 1.5-3 3 0 2 1.5 3 3 3 2 0 4 1 4 4Z" />
    </svg>
  );
}
