"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { PRIMARY_NAV, type NavItem } from "@/lib/navigation";

type Item = { id: string; label: string };

type Props = {
  conversations: Item[];
  projects: Item[];
  documents: Item[];
  workflows: Item[];
  isAdmin: boolean;
};

// Pages « profondes » propres à la palette (réglages granulaires que la barre
// latérale n'expose pas). La nav primaire vient de la source unique PRIMARY_NAV.
// `labelKey` est résolu dans le namespace `commandPalette.pages`.
const SETTINGS_PAGES: NavItem[] = [
  { href: "/settings/general", labelKey: "settings", icon: IconSettings },
  { href: "/settings/profile", labelKey: "profile", icon: IconSettings },
  { href: "/settings/usage", labelKey: "usage", icon: IconCash },
  { href: "/settings/providers", labelKey: "providers", icon: IconKey },
  {
    href: "/settings/connectors",
    labelKey: "connectors",
    icon: IconPlugConnected,
  },
  { href: "/settings/mcp", labelKey: "mcp", icon: IconBolt },
];

// `labelKey` résolu dans le namespace `commandPalette.actions`.
const ACTIONS: readonly NavItem[] = [
  { href: "/chat", labelKey: "newConversation", icon: IconMessageCircle },
  { href: "/workflows", labelKey: "newWorkflow", icon: IconLibrary },
  { href: "/projects", labelKey: "newProject", icon: IconFolders },
  { href: "/tabular-reviews/new", labelKey: "newTabularReview", icon: IconTable },
];

export function CommandPalette({
  conversations,
  projects,
  documents,
  workflows,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const t = useTranslations("commandPalette");
  const tNav = useTranslations("nav");

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
      <CommandInput placeholder={t("searchPlaceholder")} />
      <CommandList>
        <CommandEmpty>{t("empty")}</CommandEmpty>

        <CommandGroup heading={t("groups.actions")}>
          {ACTIONS.map((a) => {
            const label = t(`actions.${a.labelKey}`);
            return (
              <CommandItem
                key={a.href}
                value={`action ${label}`}
                onSelect={() => go(a.href)}
              >
                <IconPlus className="text-primary" />
                {label}
              </CommandItem>
            );
          })}
        </CommandGroup>

        {conversations.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("groups.conversations")}>
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
            <CommandGroup heading={t("groups.projects")}>
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
            <CommandGroup heading={t("groups.documents")}>
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
            <CommandGroup heading={t("groups.workflows")}>
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
        <CommandGroup heading={t("groups.navigation")}>
          {PRIMARY_NAV.map((p) => {
            const Icon = p.icon;
            const label = tNav(p.labelKey);
            return (
              <CommandItem
                key={p.href}
                value={`page ${label}`}
                onSelect={() => go(p.href)}
              >
                <Icon className="text-muted-foreground" />
                {label}
              </CommandItem>
            );
          })}
          {SETTINGS_PAGES.map((p) => {
            const Icon = p.icon;
            const label = t(`pages.${p.labelKey}`);
            return (
              <CommandItem
                key={p.href}
                value={`page ${label}`}
                onSelect={() => go(p.href)}
              >
                <Icon className="text-muted-foreground" />
                {label}
              </CommandItem>
            );
          })}
          {isAdmin && (
            <CommandItem
              value="admin"
              onSelect={() => go("/admin/users")}
            >
              <IconShieldLock className="text-primary" />
              {tNav("admin")}
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
      <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
        <span>{t("footerHint")}</span>
        <CommandShortcut>⌘K</CommandShortcut>
      </div>
    </CommandDialog>
  );
}
