"use client";

import { useSyncExternalStore } from "react";
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
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
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
  /** Forces open layout (used inside Sheet on mobile). */
  forceOpen?: boolean;
};

const STORAGE_KEY = "louis:sidebarOpen";
const STORAGE_EVENT = "louis:sidebarOpen-change";

function subscribe(cb: () => void) {
  window.addEventListener(STORAGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(STORAGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): string {
  return window.localStorage.getItem(STORAGE_KEY) ?? "true";
}

function getServerSnapshot(): string {
  return "true";
}

export function SidebarContent({ user, onNavigate, forceOpen }: Props) {
  const pathname = usePathname();
  const persisted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const open = forceOpen ? true : persisted !== "false";

  function toggle() {
    const next = open ? "false" : "true";
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }

  const initials = (user.name || user.email).slice(0, 1).toUpperCase();

  return (
    <div
      className={`h-full flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-200 ${
        open ? "w-64" : "w-14"
      }`}
    >
      {/* Logo + toggle */}
      <div
        className={`flex items-center px-2.5 py-3 ${
          open ? "justify-between" : "justify-center"
        }`}
      >
        {open && (
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="flex items-center gap-2 px-2 hover:opacity-80 transition-opacity"
          >
            <OakLogo className="size-5 text-primary" />
            <span className="font-heading text-2xl font-light tracking-tight leading-none">
              Louis
            </span>
          </Link>
        )}
        {!forceOpen && (
          <button
            onClick={toggle}
            className="size-9 inline-flex items-center justify-center rounded-md hover:bg-sidebar-accent transition-colors"
            title={open ? "Réduire" : "Ouvrir"}
            aria-label={open ? "Réduire la barre latérale" : "Ouvrir la barre latérale"}
          >
            {open ? (
              <IconLayoutSidebarLeftCollapse className="size-4" />
            ) : (
              <IconLayoutSidebarLeftExpand className="size-4" />
            )}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-0.5">
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
              title={!open ? item.label : undefined}
              className={`flex items-center gap-3 h-9 px-2.5 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {open && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}

        {user.role === "admin" && (
          <Link
            href="/admin/users"
            onClick={onNavigate}
            title={!open ? "Administration" : undefined}
            className={`flex items-center gap-3 h-9 px-2.5 rounded-md text-sm transition-colors mt-3 ${
              pathname.startsWith("/admin")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent"
            }`}
          >
            <IconShieldLock className="size-4 shrink-0 text-primary" />
            {open && <span className="truncate">Administration</span>}
          </Link>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border p-2.5 space-y-1">
        <div
          className={`flex items-center gap-2.5 px-2 py-1.5 ${
            !open ? "justify-center" : ""
          }`}
        >
          <div className="size-7 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
            {initials}
          </div>
          {open && (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">{user.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {user.email}
              </div>
            </div>
          )}
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            title={!open ? "Se déconnecter" : undefined}
            className={`w-full flex items-center gap-3 h-9 px-2.5 rounded-md text-sm hover:bg-sidebar-accent transition-colors text-left ${
              !open ? "justify-center" : ""
            }`}
          >
            <IconLogout className="size-4 shrink-0" />
            {open && <span>Se déconnecter</span>}
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
