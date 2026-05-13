"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Spinner } from "@/components/ui/spinner";

// Worker servi localement par /api/pdf-worker (pas de CDN tiers).
pdfjs.GlobalWorkerOptions.workerSrc = "/api/pdf-worker";

type Props = {
  fileUrl: string;
  targetText?: string;
};

export function PdfView({ fileUrl, targetText }: Props) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [width, setWidth] = useState(380);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLElement | null>(null);

  // Le passage cible (chunk) pour customTextRenderer — premières 60 chars
  // suffisent à matcher une fraction de phrase sans trop de faux positifs.
  const needle = (targetText ?? "").trim().slice(0, 60);

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

  // Wrap les segments de texte qui matchent le needle. AnnotationLayer/TextLayer
  // de react-pdf injectent le HTML retourné directement.
  const textRenderer = useCallback(
    ({ str }: { str: string }) => {
      if (!needle) return str;
      const lower = str.toLowerCase();
      const idx = lower.indexOf(needle.toLowerCase());
      if (idx < 0) return str;
      const before = str.slice(0, idx);
      const match = str.slice(idx, idx + needle.length);
      const after = str.slice(idx + needle.length);
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
  }, [needle, currentPage, numPages]);

  return (
    <div className="flex flex-col h-full">
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-muted/30 p-2 flex justify-center"
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
              Impossible de charger le PDF.
            </div>
          }
        >
          {numPages && (
            <Page
              pageNumber={currentPage}
              width={width}
              customTextRenderer={textRenderer}
              renderAnnotationLayer={false}
              className="shadow-sm"
            />
          )}
        </Document>
      </div>

      {numPages && numPages > 1 && (
        <div className="border-t border-border px-3 py-1.5 flex items-center justify-center gap-2 text-xs shrink-0">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="size-7 inline-flex items-center justify-center rounded-md hover:bg-accent disabled:opacity-40 transition-colors"
            aria-label="Page précédente"
          >
            <IconChevronLeft className="size-4" />
          </button>
          <span className="tabular-nums text-muted-foreground">
            {currentPage} / {numPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= numPages}
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            className="size-7 inline-flex items-center justify-center rounded-md hover:bg-accent disabled:opacity-40 transition-colors"
            aria-label="Page suivante"
          >
            <IconChevronRight className="size-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <style>{`
        .louis-highlight {
          background-color: rgb(254 240 138);
          color: inherit;
          border-radius: 2px;
          padding: 0 1px;
        }
        :is(.dark) .louis-highlight {
          background-color: rgb(202 138 4 / 0.4);
        }
      `}</style>
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
