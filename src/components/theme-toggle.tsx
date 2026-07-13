"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { IconSun, IconMoon, IconDeviceLaptop } from "@tabler/icons-react";

/**
 * Toggle clair / sombre / système. Triple-state cyclique sur un seul bouton
 * dans la sidebar — un dropdown serait disproportionné pour un usage peu
 * fréquent.
 *
 * `useSyncExternalStore` est utilisé à la place du pattern
 * useState+useEffect classique pour éviter un setState synchrone dans un
 * effet (lint react-hooks/set-state-in-effect). Côté serveur la snapshot
 * renvoie false, côté client true — sans hydration mismatch.
 */
function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();
  const t = useTranslations("theme");

  if (!mounted) {
    return (
      <span
        className={
          className ??
          "size-9 inline-flex items-center justify-center rounded-md"
        }
        aria-hidden
      />
    );
  }

  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const label =
    theme === "light"
      ? t("toggleLight")
      : theme === "dark"
        ? t("toggleDark")
        : t("toggleSystem");
  const Icon =
    theme === "light"
      ? IconSun
      : theme === "dark"
        ? IconMoon
        : IconDeviceLaptop;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={label}
      aria-label={label}
      data-theme-current={theme}
      data-theme-resolved={resolvedTheme}
      className={
        className ??
        "size-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
      }
    >
      <Icon className="size-4" />
    </button>
  );
}
