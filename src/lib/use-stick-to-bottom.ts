"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

/**
 * Auto-scroll « collant » sur un container scrollable : tant que l'utilisateur
 * reste au bas du flux, on suit chaque nouveau contenu. Dès qu'il scrolle
 * vers le haut (lecture, copie, vérification), on se détache — plus jamais
 * de scroll forcé sous ses yeux pendant qu'il lit. Un bouton externe
 * (`scrollToBottom`) permet de revenir au bas et de réactiver le stick.
 *
 * Pattern observé sur claude.ai, ChatGPT, Vercel chat-sdk. Évite le pire
 * anti-pattern UX : « je relis le début, l'app me ramène en bas ».
 */
export function useStickToBottom<T extends HTMLElement>(opts?: {
  /** Tolérance en px pour considérer qu'on est « au bas ». Défaut 24. */
  threshold?: number;
}): {
  containerRef: RefObject<T | null>;
  isStuck: boolean;
  scrollToBottom: () => void;
} {
  const threshold = opts?.threshold ?? 24;
  const containerRef = useRef<T | null>(null);
  const [isStuck, setIsStuck] = useState(true);
  const isStuckRef = useRef(true);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const stuck = distance <= threshold;
    if (stuck !== isStuckRef.current) {
      isStuckRef.current = stuck;
      setIsStuck(stuck);
    }
  }, [threshold]);

  // Listener scroll : mesure si on est toujours collé après une action user.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => measure();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [measure]);

  // Observer le contenu : à chaque ajout de message ou nouveau chunk de
  // markdown, on re-scroll au bas SI on était collé. MutationObserver
  // capture tous les changements DOM (texte, nœuds), donc on suit aussi
  // les streams character-par-character du useSmoothText.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const obs = new MutationObserver(() => {
      if (isStuckRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    });
    obs.observe(el, { childList: true, subtree: true, characterData: true });

    // Initial scroll au montage.
    el.scrollTop = el.scrollHeight;

    return () => obs.disconnect();
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    // Set immédiat pour éviter le délai entre scroll smooth et reattach.
    isStuckRef.current = true;
    setIsStuck(true);
  }, []);

  return { containerRef, isStuck, scrollToBottom };
}
