"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";

/**
 * Rendu DOCX côté client via `docx-preview` — la lib parse le buffer
 * DOCX et le rend en DOM avec préservation des titres, listes, tables,
 * tracked changes (renderChanges: true), inline formatting.
 *
 * Approche identique à celle de Mike OSS : on fetch les bytes, on
 * appelle renderAsync, et on applique un zoom CSS adaptatif pour que
 * la page Word (largeur native ~816px) tienne dans un panel plus
 * étroit sans débordement horizontal.
 *
 * Pas de dépendance serveur (LibreOffice/Gotenberg) — tout se passe
 * dans le navigateur de l'utilisateur.
 */
export function DocxView({
  documentId,
  targetText,
  className,
}: {
  documentId: string;
  /** Texte à highlighter et scroller après le rendu (citation cliquée). */
  targetText?: string;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Adapte la largeur via zoom CSS sur chaque page docx-preview, à
  // chaque resize du panel — sinon les pages Word natives (~816px)
  // débordent horizontalement dans un panel de 520-760px.
  const applyDocxScale = () => {
    const containerEl = containerRef.current;
    const scrollEl = scrollRef.current;
    if (!containerEl || !scrollEl) return;
    const sections = Array.from(
      containerEl.querySelectorAll<HTMLElement>("section.docx")
    );
    if (sections.length === 0) return;
    sections.forEach((s) => (s.style.zoom = "1"));
    const styles = window.getComputedStyle(scrollEl);
    const padX =
      (parseFloat(styles.paddingLeft) || 0) +
      (parseFloat(styles.paddingRight) || 0);
    const available = scrollEl.clientWidth - padX;
    if (available <= 0) return;
    sections.forEach((s) => {
      const w = s.offsetWidth;
      if (!w) return;
      const scale = Math.min(1, available / w);
      s.style.zoom = String(scale);
    });
  };

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const containerEl = containerRef.current;
    if (!scrollEl || !containerEl) return;
    let raf = 0;
    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(applyDocxScale);
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(scrollEl);
    ro.observe(containerEl);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const containerEl = containerRef.current;
    if (!containerEl) return;

    (async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/file`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;

        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;
        // Reset container avant le re-render. replaceChildren() est
        // l'équivalent moderne sans innerHTML (le hook security flag).
        containerEl.replaceChildren();
        await renderAsync(bytes, containerEl, undefined, {
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          renderChanges: true, // affiche les <w:ins>/<w:del> stylés
          experimental: true,
        });
        if (cancelled) return;
        applyDocxScale();
        // Highlight la citation et scroll dessus si fournie.
        if (targetText && containerEl && scrollRef.current) {
          highlightAndScroll(containerEl, scrollRef.current, targetText);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Render error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId, targetText]);

  return (
    <div
      ref={scrollRef}
      className={`flex-1 min-h-0 overflow-auto bg-background px-4 ${className ?? ""}`}
    >
      {/* Override de la bande grise foncée que docx-preview injecte
          au-dessus de la première page (margin/header de page Word). */}
      <style>{`
        .docx-view-container .docx-wrapper {
          background: transparent !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .docx-view-container .docx-wrapper > section.docx {
          margin: 1rem auto !important;
          box-shadow: 0 0 0 1px oklch(0.92 0.008 265);
        }
      `}</style>
      {loading && (
        <div className="flex h-full items-center justify-center">
          <Spinner className="size-5" />
        </div>
      )}
      {error && (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      <div ref={containerRef} className="docx-view-container" />
    </div>
  );
}

/**
 * Localise le texte de citation dans le DOM rendu (whitespace tolérant)
 * et le wrap dans un <mark.louis-quote-mark> pour highlight, puis scroll
 * en vue. Approche style highlightDocxQuote chez Mike, version minimale.
 */
function highlightAndScroll(
  container: HTMLElement,
  scrollEl: HTMLElement,
  needle: string
): void {
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const target = normalize(needle);
  if (target.length < 4) return;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const text = normalize(node.nodeValue ?? "");
    if (text.includes(target)) {
      const raw = node.nodeValue ?? "";
      const start = raw.indexOf(needle.trim());
      if (start >= 0) {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + needle.trim().length);
        const mark = document.createElement("mark");
        mark.className = "louis-quote-mark";
        mark.style.backgroundColor = "oklch(0.94 0.12 90)";
        mark.style.color = "inherit";
        range.surroundContents(mark);
        const rect = mark.getBoundingClientRect();
        const scrollRect = scrollEl.getBoundingClientRect();
        const offset =
          rect.top -
          scrollRect.top +
          scrollEl.scrollTop -
          scrollEl.clientHeight / 2 +
          rect.height / 2;
        scrollEl.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
        return;
      }
    }
    node = walker.nextNode() as Text | null;
  }
}
