"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  /** Markdown canonique du document (documents.extracted_text). */
  markdown: string;
  /** Citation cliquée — surlignée et amenée à l'écran si trouvée. */
  targetText?: string;
};

/** Normalise pour une comparaison tolérante (casse, espaces, accents). */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Rend le Markdown d'un document (PDF converti ou OCR) avec le même style
 * `prose` que les réponses de l'assistant. Quand une citation est passée, on
 * la localise dans le DOM rendu, on la surligne et on la fait défiler à l'écran
 * — l'équivalent Markdown du highlight déjà présent dans PdfView / DocxView.
 */
export function MarkdownDocView({ markdown, targetText }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !targetText) return;
    const needle = normalize(targetText).slice(0, 120);
    if (needle.length < 8) return;

    // Parcourt les nœuds texte et surligne le premier contenant la citation.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const value = node.nodeValue ?? "";
      if (normalize(value).includes(needle.slice(0, 40))) {
        const parent = node.parentElement;
        if (parent) {
          parent.classList.add(
            "rounded",
            "bg-yellow-200/60",
            "dark:bg-yellow-500/30"
          );
          parent.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        break;
      }
    }
  }, [targetText, markdown]);

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 overflow-y-auto px-6 py-5"
    >
      <article className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </article>
    </div>
  );
}
