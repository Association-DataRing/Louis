"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  IconX,
  IconFileText,
  IconFile,
  IconAlertTriangle,
  IconDownload,
  IconPencil,
  IconEye,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import { IconMarkdown } from "@tabler/icons-react";
import { Spinner } from "@/components/ui/spinner";
import { DocxView } from "./docx-view";
import { MarkdownDocView } from "./markdown-doc-view";
import { DocEditor, type DocEditorHandle } from "./doc-editor";

// PdfView importe pdfjs qui touche DOMMatrix / window au module-eval —
// donc browser-only. Dynamic import ssr:false évite « DOMMatrix is not
// defined » au rendu serveur de la route /chat.
const PdfView = dynamic(() => import("./pdf-view").then((m) => m.PdfView), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <Spinner className="size-5" />
    </div>
  ),
});

const DOCX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type DocPreview = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  version: number;
  extractedText: string | null;
  textFormat: string;
  extractionStatus: string;
  hasPdfPreview: boolean;
};

type Props = {
  documentId: string;
  /** Citation cliquée — passé aux vues d'aperçu pour scroll/highlight. */
  targetText?: string;
  onClose: () => void;
  /** Bascule le panneau sur un autre document (ex : nouvelle version au save). */
  onReplace?: (documentId: string) => void;
  /** Pilote l'animation de sortie : le parent démonte après l'anim. */
  closing?: boolean;
};

export function DocPanel({
  documentId,
  targetText,
  onClose,
  onReplace,
  closing,
}: Props) {
  const [doc, setDoc] = useState<DocPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Une citation cliquée ouvre en aperçu (highlight/scroll y fonctionnent) ;
  // sinon on ouvre directement en édition.
  const [mode, setMode] = useState<"edit" | "preview">(
    targetText ? "preview" : "edit"
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const editorRef = useRef<DocEditorHandle>(null);

  // PDF : bascule entre l'aperçu visuel fidèle (PdfView) et le Markdown
  // canonique (ce que l'IA voit réellement). Une citation cliquée ouvre sur
  // l'aperçu PDF, où le highlight ciblé est le plus précis.
  const [pdfView, setPdfView] = useState<"pdf" | "markdown">("pdf");

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
        // Un PDF n'est pas éditable → on force l'aperçu.
        if (d.contentType !== DOCX_MEDIA_TYPE) setMode("preview");
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
  const isDocx = doc?.contentType === DOCX_MEDIA_TYPE;
  const editing = isDocx && mode === "edit";
  const Icon = isPdf ? IconFileText : IconFile;

  async function handleSave() {
    const json = editorRef.current?.getJSON();
    if (!json) return;
    setSaving(true);
    setSaveError(null);
    try {
      const r = await fetch(`/api/documents/${documentId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc: json }),
      });
      if (!r.ok) throw new Error(await r.text());
      const { documentId: newId } = (await r.json()) as { documentId: string };
      setDirty(false);
      // Bascule sur la nouvelle version (remount du panneau).
      if (onReplace) onReplace(newId);
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : "Échec de l'enregistrement"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-l border-border bg-card/40 w-[520px] lg:w-[640px] xl:w-[760px] max-md:fixed max-md:inset-0 max-md:z-50 max-md:w-full max-md:bg-background ${
        closing
          ? "motion-safe:animate-out motion-safe:fade-out-0 motion-safe:slide-out-to-right-6 motion-safe:duration-200"
          : "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-6 motion-safe:duration-300 motion-safe:ease-out"
      }`}
      role="region"
      aria-label="Aperçu du document"
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 h-[52px] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">
            {doc?.filename ?? "Chargement…"}
          </span>
          {doc && doc.version > 1 && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              v{doc.version}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Toggle Éditer / Aperçu — uniquement pour les .docx. */}
          {isDocx && (
            <button
              onClick={() => setMode(editing ? "preview" : "edit")}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title={editing ? "Aperçu fidèle (PDF)" : "Éditer le document"}
            >
              {editing ? (
                <>
                  <IconEye className="size-4" />
                  Aperçu
                </>
              ) : (
                <>
                  <IconPencil className="size-4" />
                  Éditer
                </>
              )}
            </button>
          )}

          {/* Toggle Aperçu PDF / Markdown — pour les PDF (le Markdown est la
              représentation canonique : RAG, prompt, analyses). */}
          {isPdf && doc?.extractedText && (
            <button
              onClick={() =>
                setPdfView(pdfView === "pdf" ? "markdown" : "pdf")
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title={
                pdfView === "pdf"
                  ? "Voir le Markdown (ce que l'IA lit)"
                  : "Revenir à l'aperçu PDF fidèle"
              }
            >
              {pdfView === "pdf" ? (
                <>
                  <IconMarkdown className="size-4" />
                  Markdown
                </>
              ) : (
                <>
                  <IconEye className="size-4" />
                  Aperçu PDF
                </>
              )}
            </button>
          )}

          {/* Enregistrer — visible en édition. */}
          {editing && (
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-40"
              title="Enregistrer comme nouvelle version"
            >
              {saving ? (
                <Spinner className="size-3.5" />
              ) : (
                <IconDeviceFloppy className="size-4" />
              )}
              Enregistrer
            </button>
          )}

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

      {saveError && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <IconAlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

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

        {/* Édition WYSIWYG (.docx). */}
        {!loading && !error && doc && editing && (
          <DocEditor
            ref={editorRef}
            documentId={documentId}
            onDirtyChange={setDirty}
          />
        )}

        {/* Aperçu fidèle. */}
        {!loading && !error && doc && !editing && isPdf && pdfView === "pdf" && (
          // PdfView (react-pdf custom) plutôt qu'un iframe : la toolbar
          // de pdf.js / Firefox n'est pas masquable via #toolbar=0,
          // donc on rend nous-mêmes la page avec une navigation propre.
          <PdfView
            fileUrl={`/api/documents/${documentId}/file`}
            targetText={targetText}
          />
        )}
        {/* Markdown canonique du PDF (conversion locale ou OCR). */}
        {!loading &&
          !error &&
          doc &&
          !editing &&
          isPdf &&
          pdfView === "markdown" && (
            <MarkdownDocView
              markdown={doc.extractedText ?? "*Aucun texte extrait.*"}
              targetText={targetText}
            />
          )}
        {!loading && !error && doc && !editing && !isPdf && doc.hasPdfPreview && (
          // Docs générés par Louis : un PDF preview a été produit via
          // LibreOffice (Gotenberg) au moment de la génération. Vraie
          // pagination A4 type Word, rendu via react-pdf (sans toolbar
          // browser parasite).
          <PdfView fileUrl={`/api/documents/${documentId}/preview-pdf`} />
        )}
        {!loading &&
          !error &&
          doc &&
          !editing &&
          !isPdf &&
          !doc.hasPdfPreview && (
            // Uploads users : leurs DOCX viennent de Word/Pages avec les
            // sauts de page pré-calculés (lastRenderedPageBreak), donc
            // docx-preview affiche la pagination correctement.
            <DocxView documentId={documentId} targetText={targetText} />
          )}
      </div>

      <footer className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground shrink-0">
        {editing
          ? "Édition WYSIWYG — « Enregistrer » crée une nouvelle version .docx."
          : isPdf
            ? pdfView === "markdown"
              ? "Markdown canonique — le texte exact lu par l'IA (RAG, prompt, analyses)."
              : "Aperçu PDF fidèle. Basculez sur « Markdown » pour voir ce que l'IA lit."
            : doc?.hasPdfPreview
              ? "Aperçu paginé via LibreOffice — identique au document Word téléchargé."
              : "Rendu DOCX via docx-preview — fidèle à l'ouverture Word/Pages."}
      </footer>
    </aside>
  );
}
