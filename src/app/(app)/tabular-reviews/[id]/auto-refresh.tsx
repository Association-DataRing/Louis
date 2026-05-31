"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Tant qu'au moins une ligne est en "running", on poll le server component
 * toutes les `intervalMs` millisecondes via router.refresh(). Le poll est
 * suspendu quand l'onglet est caché (visibilitychange) pour ne pas brûler
 * cycles et bande passante en arrière-plan. L'utilisateur peut aussi le
 * suspendre manuellement via le bouton.
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
  const [paused, setPaused] = useState(false);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    if (!hasRunning || paused) return;

    const start = () => {
      if (tickRef.current) return;
      tickRef.current = setInterval(() => {
        router.refresh();
        setAnnounce("Statuts mis à jour.");
      }, intervalMs);
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
  }, [hasRunning, intervalMs, router, paused]);

  if (!hasRunning) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setPaused((p) => !p)}
      >
        {paused ? "Reprendre" : "Suspendre l'actualisation"}
      </Button>
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
    </>
  );
}
