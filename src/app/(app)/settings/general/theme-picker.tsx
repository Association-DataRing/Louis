"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { IconSun, IconMoon, IconDeviceLaptop, IconCheck } from "@tabler/icons-react";

function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

const options = [
  { value: "light", labelKey: "light", icon: IconSun },
  { value: "dark", labelKey: "dark", icon: IconMoon },
  { value: "system", labelKey: "system", icon: IconDeviceLaptop },
] as const;

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const t = useTranslations("theme");
  const current = mounted ? theme ?? "system" : "system";

  return (
    <div
      className="inline-flex rounded-lg border border-border bg-card p-1 gap-1"
      role="radiogroup"
      aria-label={t("label")}
    >
      {options.map((o) => {
        const Icon = o.icon;
        const active = current === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o.value)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
              active
                ? "bg-accent text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {t(o.labelKey)}
            {active && <IconCheck className="size-3.5" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
