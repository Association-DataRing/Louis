"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Tant qu'au moins une ligne est en "running", on poll le server component
 * toutes les `intervalMs` millisecondes via router.refresh(). Aucune requête
 * supplémentaire à coder : Next renvoie un payload incrémental.
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
    tickRef.current = setInterval(() => router.refresh(), intervalMs);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [hasRunning, intervalMs, router]);

  return null;
}
