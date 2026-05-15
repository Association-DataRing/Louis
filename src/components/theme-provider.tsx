"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";

/**
 * ThemeProvider monté à la racine du layout. Active le toggle clair / sombre /
 * système via la classe `.dark` sur `<html>`. `suppressHydrationWarning` est
 * déjà posé sur `<html>` côté racine.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
