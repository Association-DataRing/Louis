"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  IconChartBar,
  IconUsers,
  IconBuilding,
  IconHistory,
} from "@tabler/icons-react";

const sections = [
  {
    groupKey: "groupCabinet",
    items: [
      { href: "/admin", labelKey: "overview", icon: IconChartBar },
      { href: "/admin/cabinet", labelKey: "configuration", icon: IconBuilding },
    ],
  },
  {
    groupKey: "groupSecurity",
    items: [
      { href: "/admin/users", labelKey: "users", icon: IconUsers },
      { href: "/admin/audit", labelKey: "auditLog", icon: IconHistory },
    ],
  },
];

export function AdminNav({ horizontal }: { horizontal?: boolean }) {
  const pathname = usePathname();
  const t = useTranslations("admin.nav");

  if (horizontal) {
    const items = sections.flatMap((s) => s.items);
    return (
      <nav className="flex items-center gap-1 text-sm">
        {items.map((item) => {
          const Icon = item.icon;
          // /admin exactement → match seulement /admin (pas /admin/xxx)
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
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
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="w-full flex flex-col gap-5">
      {sections.map((group) => (
        <div key={group.groupKey}>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1 px-2">
            {t(group.groupKey)}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
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
                    {t(item.labelKey)}
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
