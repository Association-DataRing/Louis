"use client";

import {
  IconX,
  IconDownload,
  IconFileTypePdf,
  IconFileTypeDocx,
} from "@tabler/icons-react";

/**
 * Panneau d'aperçu pour un document généré (PDF ou DOCX édité).
 *
 * - PDF : iframe natif (tous les navigateurs récents savent rendre un PDF)
 * - DOCX : pas d'aperçu inline possible côté browser (Word/Pages
 *   uniquement), on affiche une carte qui propose le download direct
 *
 * S'ouvre en aside side-by-side sur desktop (jumelé au chat), en overlay
 * plein écran sur mobile.
 */
export function ExportPreviewPanel({
  url,
  filename,
  format,
  onClose,
}: {
  url: string;
  filename: string;
  format: "docx" | "pdf";
  onClose: () => void;
}) {
  const Icon = format === "pdf" ? IconFileTypePdf : IconFileTypeDocx;

  const body =
    format === "pdf" ? (
      <iframe
        src={url}
        title={filename}
        className="flex-1 min-h-0 w-full border-0 bg-background"
      />
    ) : (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-8 gap-3">
        <div className="size-16 rounded-md border border-border bg-card flex items-center justify-center">
          <Icon className="size-8 text-primary" />
        </div>
        <p className="font-heading text-lg tracking-tight">{filename}</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Les fichiers Word ne peuvent pas être prévisualisés dans le
          navigateur — ouvrez-le dans Word, Pages ou LibreOffice après
          téléchargement.
        </p>
        <a
          href={url}
          download={filename}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <IconDownload className="size-4" />
          Télécharger
        </a>
      </div>
    );

  const header = (
    <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="size-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate">{filename}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a
          href={url}
          download={filename}
          className="size-10 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Télécharger"
          aria-label="Télécharger"
        >
          <IconDownload className="size-4" />
        </a>
        <button
          type="button"
          onClick={onClose}
          className="size-10 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Fermer"
        >
          <IconX className="size-5" />
        </button>
      </div>
    </header>
  );

  return (
    <>
      {/* Desktop : panneau side-by-side ancré à droite */}
      <aside className="hidden md:flex w-[440px] lg:w-[520px] shrink-0 border-l border-border bg-card/40 flex-col h-full">
        {header}
        {body}
      </aside>
      {/* Mobile : overlay plein écran */}
      <div
        className="md:hidden fixed inset-0 z-50 flex flex-col bg-background animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Aperçu du document généré"
      >
        {header}
        {body}
      </div>
    </>
  );
}
