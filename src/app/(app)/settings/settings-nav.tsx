"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconAdjustments,
  IconUser,
  IconKey,
  IconPlugConnected,
  IconBolt,
  IconCash,
  IconShieldLock,
  IconCpu,
  IconSparkles,
} from "@tabler/icons-react";

const sections = [
  {
    group: "Compte",
    items: [
      { href: "/settings/general", label: "Général", icon: IconAdjustments },
      { href: "/settings/profile", label: "Profil", icon: IconUser },
      { href: "/settings/usage", label: "Coûts & usage", icon: IconCash },
    ],
  },
  {
    group: "Intégrations",
    items: [
      { href: "/settings/providers", label: "Providers IA", icon: IconKey },
      { href: "/settings/models", label: "Modèles", icon: IconCpu },
      { href: "/settings/skills", label: "Skills", icon: IconSparkles },
      {
        href: "/settings/connectors",
        label: "Connecteurs",
        icon: IconPlugConnected,
      },
      { href: "/settings/mcp", label: "Serveurs MCP", icon: IconBolt },
    ],
  },
];

const adminSection = {
  group: "Administration",
  items: [
    { href: "/admin/users", label: "Utilisateurs", icon: IconShieldLock },
  ],
};

export function SettingsNav({
  isAdmin,
  horizontal,
}: {
  isAdmin: boolean;
  horizontal?: boolean;
}) {
  const pathname = usePathname();
  const all = isAdmin ? [...sections, adminSection] : sections;

  if (horizontal) {
    const items = all.flatMap((s) => s.items);
    return (
      <nav className="flex items-center gap-1 text-sm">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              }`}
            >
              <Icon className="size-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="w-full flex flex-col gap-5">
      {all.map((group) => (
        <div key={group.group}>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 px-2">
            {group.group}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-2.5 h-9 px-2.5 rounded-md text-sm transition-colors ${
                      active
                        ? "bg-accent text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
