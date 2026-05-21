"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  IconX,
  IconFileText,
  IconFile,
  IconAlertTriangle,
  IconDownload,
} from "@tabler/icons-react";
import { Spinner } from "@/components/ui/spinner";
import { DocxView } from "./docx-view";

// PdfView importe pdfjs qui touche DOMMatrix / window au module-eval —
// donc browser-only. Dynamic import ssr:false évite « DOMMatrix is not
// defined » au rendu serveur de la route /chat.
const PdfView = dynamic(
  () => import("./pdf-view").then((m) => m.PdfView),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <Spinner className="size-5" />
      </div>
    ),
  }
);

type DocPreview = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  extractedText: string | null;
  extractionStatus: string;
  hasPdfPreview: boolean;
};

type Props = {
  documentId: string;
  /** Citation cliquée — passé à DocxView pour scroll/highlight. */
  targetText?: string;
  onClose: () => void;
};

export function DocPanel({ documentId, targetText, onClose }: Props) {
  const [doc, setDoc] = useState<DocPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Le parent passe key={documentId} → ce composant remount sur changement
  // de document, useState repart frais. Pas besoin de reset manuel ici.
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

  const isPdf = doc?.contentType === "application/pdf";
  const Icon = isPdf ? IconFileText : IconFile;

  const body = (
    <>
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 h-[52px] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">
            {doc?.filename ?? "Chargement…"}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {doc && (
            <a
              href={`/api/documents/${documentId}/file?download=1`}
              download={doc.filename}
              className="size-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Télécharger"
              aria-label="Télécharger"
            >
              <IconDownload className="size-4" />
            </a>
          )}
          <button
            onClick={onClose}
            className="size-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Fermer le document"
          >
            <IconX className="size-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Spinner className="size-5" />
          </div>
        )}
        {error && (
          <div className="mx-5 my-4 flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            <IconAlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {!loading && !error && doc && isPdf && (
          // PdfView (react-pdf custom) plutôt qu'un iframe : la toolbar
          // de pdf.js / Firefox n'est pas masquable via #toolbar=0,
          // donc on rend nous-mêmes la page avec une navigation propre.
          <PdfView fileUrl={`/api/documents/${documentId}/file`} targetText={targetText} />
        )}
        {!loading && !error && doc && !isPdf && doc.hasPdfPreview && (
          // Docs générés par Louis : un PDF preview a été produit via
          // LibreOffice (Gotenberg) au moment de la génération. Vraie
          // pagination A4 type Word, rendu via react-pdf (sans toolbar
          // browser parasite).
          <PdfView fileUrl={`/api/documents/${documentId}/preview-pdf`} />
        )}
        {!loading && !error && doc && !isPdf && !doc.hasPdfPreview && (
          // Uploads users : leurs DOCX viennent de Word/Pages avec les
          // sauts de page pré-calculés (lastRenderedPageBreak), donc
          // docx-preview affiche la pagination correctement.
          <DocxView documentId={documentId} targetText={targetText} />
        )}
      </div>

      <footer className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground shrink-0">
        {isPdf
          ? "Aperçu PDF natif du navigateur."
          : doc?.hasPdfPreview
            ? "Aperçu paginé via LibreOffice — identique au document Word téléchargé."
            : "Rendu DOCX via docx-preview — fidèle à l'ouverture Word/Pages."}
      </footer>
    </>
  );

  return (
    <>
      <aside className="hidden md:flex w-[520px] lg:w-[640px] xl:w-[760px] shrink-0 border-l border-border bg-card/40 flex-col h-full">
        {body}
      </aside>
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
