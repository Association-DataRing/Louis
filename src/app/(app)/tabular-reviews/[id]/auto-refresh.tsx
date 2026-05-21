"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Tant qu'au moins une ligne est en "running", on poll le server component
 * toutes les `intervalMs` millisecondes via router.refresh(). Le poll est
 * suspendu quand l'onglet est caché (visibilitychange) pour ne pas brûler
 * cycles et bande passante en arrière-plan.
 */
export function AutoRefresh({
  hasRunning,
  intervalMs = 2500,
}: {
  hasRunning: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!hasRunning) return;

    const start = () => {
      if (tickRef.current) return;
      tickRef.current = setInterval(() => router.refresh(), intervalMs);
    };
    const stop = () => {
      if (!tickRef.current) return;
      clearInterval(tickRef.current);
      tickRef.current = null;
    };

    if (document.visibilityState === "visible") start();
    const onVis = () => {
      if (document.visibilityState === "visible") {
        // Refresh immédiat au retour pour rattraper d'éventuelles MAJ.
        router.refresh();
        start();
      } else {
        stop();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, [hasRunning, intervalMs, router]);

  return null;
}
