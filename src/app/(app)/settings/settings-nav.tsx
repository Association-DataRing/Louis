"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
  IconBrain,
  IconScan,
} from "@tabler/icons-react";

const sections = [
  {
    group: "nav.account",
    items: [
      { href: "/settings/general", label: "nav.general", icon: IconAdjustments },
      { href: "/settings/profile", label: "nav.profile", icon: IconUser },
      { href: "/settings/security", label: "nav.security", icon: IconShieldLock },
      { href: "/settings/usage", label: "nav.usage", icon: IconCash },
    ],
  },
  {
    group: "nav.integrations",
    items: [
      { href: "/settings/providers", label: "nav.providers", icon: IconKey },
      { href: "/settings/models", label: "nav.models", icon: IconCpu },
      { href: "/settings/ocr", label: "nav.ocr", icon: IconScan },
      { href: "/settings/skills", label: "nav.skills", icon: IconSparkles },
      { href: "/settings/memory", label: "nav.memory", icon: IconBrain },
      {
        href: "/settings/connectors",
        label: "nav.connectors",
        icon: IconPlugConnected,
      },
      { href: "/settings/mcp", label: "nav.mcp", icon: IconBolt },
    ],
  },
];

const adminSection = {
  group: "nav.administration",
  items: [
    { href: "/admin/users", label: "nav.users", icon: IconShieldLock },
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
  const t = useTranslations("settings.layout");
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
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              }`}
            >
              <Icon className="size-3.5" />
              {t(item.label)}
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
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1 px-2">
            {t(group.group)}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 h-9 px-2.5 rounded-md text-sm transition-colors ${
                      active
                        ? "bg-accent text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    {t(item.label)}
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
