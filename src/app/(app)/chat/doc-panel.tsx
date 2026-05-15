"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconX,
  IconFileText,
  IconFile,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Spinner } from "@/components/ui/spinner";

type DocPreview = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  extractedText: string | null;
  extractionStatus: string;
};

type Props = {
  documentId: string;
  targetText?: string;
  onClose: () => void;
};

export function DocPanel({ documentId, targetText, onClose }: Props) {
  const [doc, setDoc] = useState<DocPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const markRef = useRef<HTMLElement>(null);

  // Reset via remount : le parent passe `key={documentId}` donc cet effet
  // ne s'exécute qu'une fois au mount, sans state-resets supplémentaires.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documents/${documentId}/preview`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<DocPreview>;
      })
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erreur de chargement");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  // Auto-scroll au passage surligné dès qu'il est rendu.
  useEffect(() => {
    if (!doc || !targetText) return;
    requestAnimationFrame(() => {
      markRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [doc, targetText]);

  const Icon =
    doc?.contentType === "application/pdf"
      ? IconFileText
      : IconFile;

  const body = (
    <>
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">
            {doc?.filename ?? "Chargement…"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="size-10 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors"
          aria-label="Fermer le document"
        >
          <IconX className="size-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Spinner className="size-5" />
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            <IconAlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {!loading && !error && doc && (
          <DocBody
            text={doc.extractedText ?? ""}
            target={targetText ?? ""}
            markRef={markRef}
          />
        )}
      </div>

      <footer className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground shrink-0">
        Texte extrait côté serveur. La mise en forme originale du document
        n&apos;est pas restituée.
      </footer>
    </>
  );

  return (
    <>
      {/* Desktop : panneau side-by-side ancré à droite */}
      <aside className="hidden md:flex w-[440px] lg:w-[480px] shrink-0 border-l border-border bg-card/40 flex-col h-full">
        {body}
      </aside>
      {/* Mobile : overlay plein écran qui glisse depuis la droite */}
      <div
        className="md:hidden fixed inset-0 z-50 flex flex-col bg-background animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Aperçu du document"
      >
        {body}
      </div>
    </>
  );
}

function DocBody({
  text,
  target,
  markRef,
}: {
  text: string;
  target: string;
  markRef: React.RefObject<HTMLElement | null>;
}) {
  if (!text) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Aucun texte extrait pour ce document.
      </p>
    );
  }

  const trimmedTarget = target.trim();
  const targetIndex = trimmedTarget ? text.indexOf(trimmedTarget) : -1;

  // Pas de match → on affiche juste le texte intégral sans highlight.
  if (targetIndex < 0) {
    return (
      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
        {text}
      </pre>
    );
  }

  const before = text.slice(0, targetIndex);
  const highlight = text.slice(targetIndex, targetIndex + trimmedTarget.length);
  const after = text.slice(targetIndex + trimmedTarget.length);

  return (
    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
      {before}
      <mark
        ref={markRef}
        className="bg-highlight text-highlight-foreground px-0.5 rounded"
      >
        {highlight}
      </mark>
      {after}
    </pre>
  );
}
