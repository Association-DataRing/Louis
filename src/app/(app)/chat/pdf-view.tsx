"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Spinner } from "@/components/ui/spinner";
import { findNormalizedAdaptive } from "@/lib/text-highlight";

// Worker servi localement par /api/pdf-worker (pas de CDN tiers).
// Query param avec la version pdfjs runtime → l'URL change quand on
// upgrade react-pdf, donc plus de risque qu'un worker périmé en cache
// navigateur (avec une autre version d'API) ne soit réutilisé.
pdfjs.GlobalWorkerOptions.workerSrc = `/api/pdf-worker?v=${pdfjs.version}`;

type Props = {
  fileUrl: string;
  targetText?: string;
};

export function PdfView({ fileUrl, targetText }: Props) {
  const t = useTranslations("chat");
  const [numPages, setNumPages] = useState<number | null>(null);
  const [width, setWidth] = useState(380);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLElement | null>(null);

  const needle = (targetText ?? "").trim();

  // Resize observer pour adapter la largeur de la page au panneau.
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => setWidth(Math.max(200, el.clientWidth - 16));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onDocumentLoad = useCallback((doc: { numPages: number }) => {
    setNumPages(doc.numPages);
  }, []);

  // Wrap le segment de texte qui contient le needle. Utilise findNormalized
  // pour gérer la divergence NFC/NFD entre la sortie pdfjs et le texte LLM.
  const textRenderer = useCallback(
    ({ str }: { str: string }) => {
      if (!needle) return str;
      const range = findNormalizedAdaptive(str, needle);
      if (!range) return str;
      const [start, end] = range;
      const before = str.slice(0, start);
      const match = str.slice(start, end);
      const after = str.slice(end);
      return `${escapeHtml(before)}<mark class="louis-highlight">${escapeHtml(match)}</mark>${escapeHtml(after)}`;
    },
    [needle]
  );

  // Scroll auto à la première occurrence dès qu'elle est rendue.
  useEffect(() => {
    if (!needle) return;
    const timer = setTimeout(() => {
      const el = containerRef.current?.querySelector("mark.louis-highlight");
      if (el) {
        markRef.current = el as HTMLElement;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [needle, numPages]);

  return (
    <div className="flex flex-col h-full">
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-muted/30 px-2 py-3 flex flex-col items-center gap-3"
      >
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoad}
          onLoadError={(e) => setError(e.message)}
          loading={
            <div className="flex items-center justify-center h-40">
              <Spinner className="size-5" />
            </div>
          }
          error={
            <div className="text-sm text-destructive p-4">
              {t("docPanel.loadPdfError")}
            </div>
          }
        >
          {numPages !== null &&
            Array.from({ length: numPages }, (_, i) => (
              <Page
                key={i + 1}
                pageNumber={i + 1}
                width={width}
                customTextRenderer={textRenderer}
                renderAnnotationLayer={false}
                className="shadow-sm bg-white mb-3 last:mb-0"
              />
            ))}
        </Document>
      </div>

      {error && (
        <div className="border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
