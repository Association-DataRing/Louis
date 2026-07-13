"use client";

import { NextIntlClientProvider, useTranslations } from "next-intl";
import { defaultLocale } from "@/i18n/config";
import errors from "../../messages/fr/errors.json";

/**
 * Dernier filet : erreur dans le root layout lui-même. Doit fournir ses
 * propres <html>/<body> (il remplace le layout racine) et ne peut pas
 * dépendre des styles applicatifs → styles inline minimaux.
 *
 * Comme ce boundary REMPLACE le root layout, il sort du
 * `NextIntlClientProvider` câblé dans `layout.tsx` : on en monte donc un
 * local, alimenté par le catalogue `fr` (langue par défaut — la locale
 * utilisateur n'est pas accessible à ce stade) pour que `useTranslations`
 * fonctionne sans contexte parent.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang={defaultLocale}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#fff",
          color: "#1a1a2e",
        }}
      >
        <NextIntlClientProvider locale={defaultLocale} messages={{ errors }}>
          <GlobalErrorContent reset={reset} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

function GlobalErrorContent({ reset }: { reset: () => void }) {
  const t = useTranslations("errors.criticalError");
  return (
    <div style={{ textAlign: "center", padding: "2rem", maxWidth: 420 }}>
      <h1 style={{ fontSize: "1.4rem", margin: 0 }}>{t("title")}</h1>
      <p style={{ color: "#555", marginTop: "0.75rem", lineHeight: 1.5 }}>
        {t("body")}
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          marginTop: "1.25rem",
          padding: "0.5rem 1rem",
          borderRadius: 6,
          border: "none",
          background: "#000091",
          color: "#fff",
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
      >
        {t("reload")}
      </button>
    </div>
  );
}
