"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconMessageCircle,
  IconFolders,
  IconFileText,
  IconLibrary,
  IconKey,
  IconPlugConnected,
  IconBolt,
  IconCash,
  IconTable,
  IconLayoutDashboard,
  IconSettings,
  IconPlus,
  IconShieldLock,
} from "@tabler/icons-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

type Item = { id: string; label: string };

type Props = {
  conversations: Item[];
  projects: Item[];
  documents: Item[];
  workflows: Item[];
  isAdmin: boolean;
};

const PAGES = [
  { href: "/dashboard", label: "Tableau de bord", icon: IconLayoutDashboard },
  { href: "/chat", label: "Conversations", icon: IconMessageCircle },
  { href: "/projects", label: "Projets", icon: IconFolders },
  { href: "/documents", label: "Documents", icon: IconFileText },
  { href: "/tabular-reviews", label: "Analyses tabulaires", icon: IconTable },
  { href: "/workflows", label: "Workflows", icon: IconLibrary },
  { href: "/usage", label: "Coûts & usage", icon: IconCash },
  { href: "/providers", label: "Providers IA", icon: IconKey },
  { href: "/connectors", label: "Connecteurs", icon: IconPlugConnected },
  { href: "/mcp", label: "Serveurs MCP", icon: IconBolt },
  { href: "/profile", label: "Mon profil", icon: IconSettings },
] as const;

const ACTIONS = [
  { href: "/chat", label: "Nouvelle conversation", icon: IconMessageCircle },
  { href: "/workflows", label: "Nouveau workflow", icon: IconLibrary },
  { href: "/projects", label: "Nouveau projet", icon: IconFolders },
  { href: "/tabular-reviews/new", label: "Nouvelle analyse tabulaire", icon: IconTable },
] as const;

export function CommandPalette({
  conversations,
  projects,
  documents,
  workflows,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Rechercher conversations, documents, projets, pages…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>

        <CommandGroup heading="Actions">
          {ACTIONS.map((a) => (
            <CommandItem
              key={a.label}
              value={`action ${a.label}`}
              onSelect={() => go(a.href)}
            >
              <IconPlus className="text-primary" />
              {a.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {conversations.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Conversations">
              {conversations.slice(0, 12).map((c) => (
                <CommandItem
                  key={c.id}
                  value={`conv ${c.label}`}
                  onSelect={() => go(`/chat?id=${c.id}`)}
                >
                  <IconMessageCircle className="text-muted-foreground" />
                  <span className="truncate">{c.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projets">
              {projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`projet ${p.label}`}
                  onSelect={() => go(`/projects/${p.id}`)}
                >
                  <IconFolders className="text-muted-foreground" />
                  <span className="truncate">{p.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {documents.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Documents">
              {documents.slice(0, 8).map((d) => (
                <CommandItem
                  key={d.id}
                  value={`doc ${d.label}`}
                  onSelect={() => go(`/documents`)}
                >
                  <IconFileText className="text-muted-foreground" />
                  <span className="truncate">{d.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {workflows.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Workflows">
              {workflows.map((w) => (
                <CommandItem
                  key={w.id}
                  value={`workflow ${w.label}`}
                  onSelect={() => go(`/workflows`)}
                >
                  <IconLibrary className="text-muted-foreground" />
                  <span className="truncate">{w.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Navigation">
          {PAGES.map((p) => {
            const Icon = p.icon;
            return (
              <CommandItem
                key={p.href}
                value={`page ${p.label}`}
                onSelect={() => go(p.href)}
              >
                <Icon className="text-muted-foreground" />
                {p.label}
              </CommandItem>
            );
          })}
          {isAdmin && (
            <CommandItem
              value="admin"
              onSelect={() => go("/admin/users")}
            >
              <IconShieldLock className="text-primary" />
              Administration
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
      <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground flex items-center justify-between">
        <span>↑↓ pour naviguer · ↵ pour ouvrir · ESC pour fermer</span>
        <CommandShortcut>⌘K</CommandShortcut>
      </div>
    </CommandDialog>
  );
}
