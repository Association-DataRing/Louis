"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  IconLayoutDashboard,
  IconKey,
  IconPlugConnected,
  IconMessageCircle,
  IconFolder,
  IconLogout,
  IconBolt,
  IconShieldLock,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconSearch,
  IconPlus,
  IconFolders,
  IconTable,
} from "@tabler/icons-react";
import { signOutAction } from "@/auth/actions";
import { LouisLogo } from "@/components/louis-logo";
import { ConversationItem } from "./chat/conversation-item";

const navItems = [
  { href: "/dashboard", label: "Tableau de bord", icon: IconLayoutDashboard },
  { href: "/chat", label: "Conversations", icon: IconMessageCircle },
  { href: "/projects", label: "Projets", icon: IconFolders },
  { href: "/documents", label: "Documents", icon: IconFolder },
  { href: "/tabular-reviews", label: "Analyses tabulaires", icon: IconTable },
  { href: "/providers", label: "Providers IA", icon: IconKey },
  { href: "/connectors", label: "Connecteurs", icon: IconPlugConnected },
  { href: "/mcp", label: "Serveurs MCP", icon: IconBolt },
];

type Conversation = { id: string; title: string; projectId: string | null };
type ProjectOption = { id: string; name: string };

type Props = {
  user: { name: string; email: string; role: string };
  conversations: Conversation[];
  projects: ProjectOption[];
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

export function SidebarContent({
  user,
  conversations,
  projects,
  onNavigate,
  forceOpen,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const persisted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const open = forceOpen ? true : persisted !== "false";
  const [convQuery, setConvQuery] = useState("");

  function toggle() {
    const next = open ? "false" : "true";
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }

  const initials = (user.name || user.email).slice(0, 1).toUpperCase();
  const currentConvId = pathname === "/chat" ? searchParams.get("id") ?? undefined : undefined;

  const filteredConversations = useMemo(() => {
    const q = convQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, convQuery]);

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
            <LouisLogo className="size-5 text-primary" />
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

      {/* Nav + conversations */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-3">
        <nav className="space-y-0.5">
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

        {/* Conversations section — only when expanded */}
        {open && (
          <section className="mt-5">
            <div className="flex items-center justify-between px-2.5 pb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Conversations
              </span>
              <Link
                href="/chat"
                onClick={onNavigate}
                title="Nouvelle conversation"
                className="size-6 inline-flex items-center justify-center rounded-md hover:bg-sidebar-accent transition-colors"
                aria-label="Nouvelle conversation"
              >
                <IconPlus className="size-3.5" />
              </Link>
            </div>

            {conversations.length > 5 && (
              <div className="px-1 pb-1.5">
                <div className="relative">
                  <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="search"
                    value={convQuery}
                    onChange={(e) => setConvQuery(e.target.value)}
                    placeholder="Rechercher…"
                    className="w-full rounded-md border border-input bg-background pl-7 pr-2 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </div>
              </div>
            )}

            <div className="space-y-0.5 px-1">
              {conversations.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-2">
                  Aucune conversation pour l&apos;instant.
                </p>
              ) : filteredConversations.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-2 text-center">
                  Aucun résultat.
                </p>
              ) : (
                filteredConversations.map((c) => (
                  <ConversationItem
                    key={c.id}
                    id={c.id}
                    title={c.title}
                    isCurrent={c.id === currentConvId}
                    currentProjectId={c.projectId}
                    projects={projects}
                  />
                ))
              )}
            </div>
          </section>
        )}
      </div>

      {/* Profile + logout */}
      <div className="border-t border-sidebar-border p-2">
        {open ? (
          <div className="flex items-center gap-1">
            <Link
              href="/profile"
              onClick={onNavigate}
              className={`flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors min-w-0 ${
                pathname.startsWith("/profile")
                  ? "bg-sidebar-accent"
                  : "hover:bg-sidebar-accent"
              }`}
              title="Mon profil"
            >
              <div className="size-7 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{user.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {user.email}
                </div>
              </div>
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                title="Se déconnecter"
                aria-label="Se déconnecter"
                className="size-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
              >
                <IconLogout className="size-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Link
              href="/profile"
              onClick={onNavigate}
              title="Mon profil"
              className="size-9 inline-flex items-center justify-center rounded-md hover:bg-sidebar-accent transition-colors"
            >
              <div className="size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                {initials}
              </div>
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                title="Se déconnecter"
                aria-label="Se déconnecter"
                className="size-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
              >
                <IconLogout className="size-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

