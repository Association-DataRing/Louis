"use client";

import { useEffect } from "react";
import { log } from "@/lib/log";

/**
 * Error boundary du segment (app) : remplace l'écran d'erreur brut Next par
 * une page brandée avec récupération (`reset`). Ne fuit pas la stack à
 * l'utilisateur (produit confidentialité-sensible).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    log.error("app", "render error boundary", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="font-heading text-2xl tracking-tight">
        Une erreur est survenue
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Quelque chose s&apos;est mal passé de notre côté. Vous pouvez réessayer ;
        si le problème persiste, contactez l&apos;administrateur de votre
        cabinet.
      </p>
      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground transition-opacity hover:opacity-90"
        >
          Réessayer
        </button>
        <a
          href="/dashboard"
          className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm transition-colors hover:bg-accent"
        >
          Tableau de bord
        </a>
      </div>
    </main>
  );
}
