"use client";

import { useEffect, useState } from "react";
import { LouisLogo } from "@/components/louis-logo";

/**
 * Phrases qui cyclent toutes les 2s pendant que l'assistant prépare sa
 * réponse. Beaucoup plus vivant qu'un seul label statique avec shimmer —
 * crée la sensation d'un raisonnement en marche sans recourir à une
 * animation graphique tape-à-l'œil.
 */
const PHRASES = [
  "Réflexion",
  "Analyse",
  "Examen",
  "Raisonnement",
  "Délibération",
];

/**
 * Indicateur affiché entre le moment où l'utilisateur envoie son message
 * et la première lettre de la réponse — y compris pendant les tool calls
 * qui n'ont pas encore produit de texte.
 */
export function ThinkingIndicator() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % PHRASES.length);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="flex items-start gap-2 text-sm text-muted-foreground"
      role="status"
      aria-label="Louis prépare sa réponse"
    >
      <LouisLogo className="size-4 text-primary mt-0.5 shrink-0" />
      <span className="inline-flex items-baseline gap-1.5" aria-hidden>
        <span
          className="size-1.5 self-center rounded-full border border-muted-foreground/70 border-t-transparent animate-spin"
          aria-hidden
        />
        <span className="text-xs font-medium tabular-nums">
          {PHRASES[index]}
        </span>
        <span className="inline-flex shrink-0 items-baseline ml-0.5" aria-hidden>
          <span className="size-0.5 rounded-full bg-muted-foreground/60 mr-0.5 animate-[bounce_1.4s_infinite_0s]" />
          <span className="size-0.5 rounded-full bg-muted-foreground/60 mr-0.5 animate-[bounce_1.4s_infinite_0.2s]" />
          <span className="size-0.5 rounded-full bg-muted-foreground/60 animate-[bounce_1.4s_infinite_0.4s]" />
        </span>
      </span>
    </div>
  );
}
