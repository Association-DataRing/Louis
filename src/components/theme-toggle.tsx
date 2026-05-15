"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { IconSun, IconMoon, IconDeviceLaptop } from "@tabler/icons-react";

/**
 * Toggle clair / sombre / système. Triple-state cyclique pour rester sur un
 * seul bouton dans la sidebar — un dropdown serait plus lourd visuellement
 * pour un usage peu fréquent.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes ne sait pas le thème avant l'hydratation : on n'affiche rien
  // pour éviter le flash entre l'icône SSR (toujours système) et la vraie.
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        type="button"
        className={
          className ??
          "size-9 inline-flex items-center justify-center rounded-md text-muted-foreground"
        }
        aria-hidden
      >
        <IconSun className="size-4 opacity-0" />
      </button>
    );
  }

  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const label =
    theme === "light"
      ? "Thème : clair (clic pour sombre)"
      : theme === "dark"
        ? "Thème : sombre (clic pour système)"
        : "Thème : système (clic pour clair)";
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
