"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lisse l'affichage d'un texte streamé. Les chunks SSE arrivent par
 * rafales (le serveur tokenize au cm, le réseau bufferise, le client
 * re-render par lots) — visuellement ça donne des « sauts » de plusieurs
 * dizaines de caractères, pas une frappe continue.
 *
 * Le hook maintient un buffer entre `text` (la cible) et le texte
 * affiché, puis draine N caractères par frame d'animation pour suivre
 * le rythme du stream à 60fps. Une cible de débit `cps` (chars/sec) fixe
 * la vitesse minimale ; quand le delta s'accumule beaucoup (rafale
 * réseau, ou stream qui se termine), on accélère automatiquement pour
 * rattraper.
 *
 * Le buffer se vide instantanément si le texte se raccourcit (regenerate,
 * edit) ou si `done=true` (stream fini, plus la peine de tenir le débit).
 */
export function useSmoothText(
  text: string,
  options: {
    /** Débit cible en caractères par seconde quand le stream est régulier. Défaut 90. */
    cps?: number;
    /** Si true, vide le buffer instantanément (fin de stream). Défaut false. */
    done?: boolean;
  } = {}
): string {
  const { cps = 90, done = false } = options;
  const [displayed, setDisplayed] = useState(text);
  const displayedRef = useRef(text);
  const targetRef = useRef(text);
  const doneRef = useRef(done);

  // Sync refs avec les props via un effect séparé. Le rAF perpétuel
  // lit ces refs et déclenche le setState quand un delta est à afficher,
  // de manière asynchrone — pas de cascade render.
  useEffect(() => {
    targetRef.current = text;
    doneRef.current = done;
  }, [text, done]);

  useEffect(() => {
    let rafId: number | null = null;
    let lastFrame: number | null = null;

    const tick = (now: number) => {
      const target = targetRef.current;
      const current = displayedRef.current;

      // Cas reset : nouvelle cible plus courte ou divergente (regenerate,
      // edit message). On saute directement à la cible — pas de rewind
      // visuel.
      if (
        target.length < current.length ||
        !target.startsWith(current)
      ) {
        displayedRef.current = target;
        setDisplayed(target);
        lastFrame = now;
        rafId = requestAnimationFrame(tick);
        return;
      }

      // Stream marqué fini : flush le reste d'un coup.
      if (doneRef.current && target.length > current.length) {
        displayedRef.current = target;
        setDisplayed(target);
        lastFrame = now;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const remaining = target.length - current.length;
      if (remaining > 0) {
        const dt = Math.max(0, now - (lastFrame ?? now));
        // Débit normal proportionnel au dt + accélération automatique
        // si le buffer enfle (rafale réseau) — sinon le texte déjà
        // arrivé prendrait des secondes à finir de s'afficher.
        const baseChars = Math.max(1, Math.round((cps * dt) / 1000));
        const catchupFactor = Math.min(8, Math.ceil(remaining / 40));
        const chars = Math.min(remaining, baseChars * catchupFactor);
        const next = target.slice(0, current.length + chars);
        displayedRef.current = next;
        setDisplayed(next);
      }
      lastFrame = now;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [cps]);

  return displayed;
}
