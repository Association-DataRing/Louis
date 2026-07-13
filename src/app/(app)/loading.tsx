/**
 * Skeleton de segment (app) — évite l'écran figé pendant le chargement des
 * Server Components multi-requêtes (dashboard, admin, usage…). Respecte
 * prefers-reduced-motion.
 */
import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("gettingStarted");
  return (
    <div
      className="mx-auto w-full max-w-5xl px-6 py-10 md:px-8 md:py-14"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{t("loading")}</span>
      <div className="motion-safe:animate-pulse">
        <div className="h-3 w-32 rounded bg-muted" />
        <div className="mt-3 h-9 w-64 rounded bg-muted" />
        <div className="mt-10 space-y-3">
          <div className="h-4 w-full rounded bg-muted/70" />
          <div className="h-4 w-5/6 rounded bg-muted/70" />
          <div className="h-4 w-2/3 rounded bg-muted/70" />
        </div>
      </div>
    </div>
  );
}
