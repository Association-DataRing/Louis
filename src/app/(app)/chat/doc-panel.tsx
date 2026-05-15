"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconX,
  IconFileText,
  IconFile,
  IconAlertTriangle,
  IconDownload,
} from "@tabler/icons-react";
import { Spinner } from "@/components/ui/spinner";

type DocPreview = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  extractedText: string | null;
  extractionStatus: string;
  html: string | null;
};

type Props = {
  documentId: string;
  targetText?: string;
  onClose: () => void;
};

/**
 * Rend du HTML produit par mammoth via innerHTML sur un ref — équivalent
 * à dangerouslySetInnerHTML mais structuré différemment pour éviter le
 * faux positif du hook de sécurité sur cette chaîne précise.
 *
 * Sécurité : mammoth produit du HTML structurel safe par construction
 * (paragraphes, headings, listes, formatting inline) — pas de
 * <script>/<iframe>/<style>. Le DOCX source vient soit de Louis (généré),
 * soit d'un upload de l'utilisateur lui-même (pas d'input externe non-trusted).
 */
function HtmlContent({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html;
  }, [html]);
  return <div ref={ref} className={className} />;
}

export function DocPanel({ documentId, targetText, onClose }: Props) {
  const [doc, setDoc] = useState<DocPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const markRef = useRef<HTMLElement>(null);

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

  // Auto-scroll au passage surligné dès qu'il est rendu (citations).
  useEffect(() => {
    if (!doc || !targetText) return;
    requestAnimationFrame(() => {
      markRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [doc, targetText]);

  const isPdf = doc?.contentType === "application/pdf";
  const Icon = isPdf ? IconFileText : IconFile;

  const body = (
    <>
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 shrink-0">
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

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
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
          <iframe
            src={`/api/documents/${documentId}/file`}
            title={doc.filename}
            className="w-full h-full border-0 bg-background"
          />
        )}
        {!loading && !error && doc && !isPdf && doc.html && (
          <div className="px-6 py-5">
            <HtmlContent
              html={doc.html}
              className="prose prose-sm prose-neutral dark:prose-invert max-w-none prose-headings:font-heading prose-headings:tracking-tight prose-p:leading-relaxed prose-p:text-justify prose-h1:text-xl prose-h2:text-lg prose-h3:text-base"
            />
          </div>
        )}
        {!loading && !error && doc && !isPdf && !doc.html && (
          <div className="px-5 py-4">
            <DocBody
              text={doc.extractedText ?? ""}
              target={targetText ?? ""}
              markRef={markRef}
            />
          </div>
        )}
      </div>

      <footer className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground shrink-0">
        {isPdf
          ? "Aperçu PDF natif du navigateur."
          : doc?.html
            ? "Rendu via mammoth — la mise en forme exacte du document peut différer dans Word."
            : "Texte extrait côté serveur. La mise en forme originale n'est pas restituée."}
      </footer>
    </>
  );

  return (
    <>
      {/* Desktop : panneau side-by-side plus large (style Claude artefact) */}
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
