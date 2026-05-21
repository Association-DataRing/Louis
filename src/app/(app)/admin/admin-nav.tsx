"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChartBar,
  IconUsers,
  IconBuilding,
  IconHistory,
} from "@tabler/icons-react";

const sections = [
  {
    group: "Cabinet",
    items: [
      { href: "/admin", label: "Vue d'ensemble", icon: IconChartBar },
      { href: "/admin/cabinet", label: "Configuration", icon: IconBuilding },
    ],
  },
  {
    group: "Sécurité",
    items: [
      { href: "/admin/users", label: "Utilisateurs", icon: IconUsers },
      { href: "/admin/audit", label: "Journal d'audit", icon: IconHistory },
    ],
  },
];

export function AdminNav({ horizontal }: { horizontal?: boolean }) {
  const pathname = usePathname();

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
      {sections.map((group) => (
        <div key={group.group}>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 px-2">
            {group.group}
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
