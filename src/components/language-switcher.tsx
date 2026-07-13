"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { IconCheck } from "@tabler/icons-react";
import { setLocaleAction } from "@/i18n/actions";
import { locales, localeLabels, type Locale } from "@/i18n/config";

/**
 * Bascule de langue (fr / en). Pose le cookie de locale via une server
 * action puis rafraîchit l'arbre serveur pour recharger les messages.
 * Même langage visuel que ThemePicker (radiogroup de boutons).
 */
export function LanguageSwitcher() {
  const current = useLocale() as Locale;
  const router = useRouter();
  const t = useTranslations("language");
  const [isPending, startTransition] = useTransition();

  function select(locale: Locale) {
    if (locale === current) return;
    startTransition(async () => {
      await setLocaleAction(locale);
      router.refresh();
    });
  }

  return (
    <div
      className="inline-flex rounded-lg border border-border bg-card p-1 gap-1"
      role="radiogroup"
      aria-label={t("label")}
    >
      {locales.map((locale) => {
        const active = current === locale;
        return (
          <button
            key={locale}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={isPending}
            onClick={() => select(locale)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors disabled:opacity-60 ${
              active
                ? "bg-accent text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {localeLabels[locale]}
            {active && <IconCheck className="size-3.5" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
