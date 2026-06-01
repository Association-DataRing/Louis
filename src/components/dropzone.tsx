"use client";

import {
  useCallback,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { IconUpload } from "@tabler/icons-react";

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

export const DEFAULT_ACCEPTED_TYPES = [PDF_MIME, DOCX_MIME, "text/"];

/**
 * Coté serveur, /api/documents/upload accepte PDF, DOCX et text/*. On
 * valide ici avant d'envoyer pour éviter un round-trip qui finirait en 415.
 */
function isAccepted(file: File, accept: string[]): boolean {
  return accept.some((t) =>
    t.endsWith("/") ? file.type.startsWith(t) : file.type === t
  );
}

export type UploadResult =
  | { ok: true; id: string; filename: string; sizeBytes: number }
  | { ok: false; error: string };

export async function uploadDocument(
  file: File,
  opts: {
    folderId?: string | null;
    signal?: AbortSignal;
  } = {}
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  if (opts.folderId) form.append("folder", opts.folderId);
  try {
    const res = await fetch("/api/documents/upload", {
      method: "POST",
      body: form,
      signal: opts.signal,
    });
    if (!res.ok) {
      const msg = (await res.text()) || `Erreur ${res.status}`;
      return { ok: false, error: msg };
    }
    const data = (await res.json()) as { id: string };
    return { ok: true, id: data.id, filename: file.name, sizeBytes: file.size };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur réseau.",
    };
  }
}

type DropzoneProps = {
  children: ReactNode;
  onFiles: (files: File[]) => void;
  /** Liste de types MIME ou préfixes (ex: "text/"). */
  accept?: string[];
  maxBytes?: number;
  disabled?: boolean;
  /** Label affiché dans l'overlay quand un fichier est draggé. */
  overlayLabel?: string;
  /** Sous-label discret sous le label principal. */
  overlayHint?: string;
  className?: string;
};

/**
 * Wrapper qui transforme ses enfants en zone de drop. Détecte les drags
 * de fichiers (`dataTransfer.types` contient "Files"), compte les enter/leave
 * pour éviter le flicker sur les enfants, et filtre les fichiers via accept +
 * maxBytes avant de remonter au consommateur.
 *
 * Les fichiers rejetés sont silencieusement ignorés — c'est au caller
 * d'afficher un retour (compter `accepted.length` vs files reçus côté
 * `onDrop` au besoin).
 */
export function Dropzone({
  children,
  onFiles,
  accept = DEFAULT_ACCEPTED_TYPES,
  maxBytes = DEFAULT_MAX_BYTES,
  disabled = false,
  overlayLabel = "Déposez vos fichiers",
  overlayHint = "PDF, DOCX ou texte — 25 Mo max par fichier",
  className,
}: DropzoneProps) {
  const [active, setActive] = useState(false);
  // `enterCount` suit les dragenter/dragleave nettement plus stablement que
  // l'event `dragleave` lui-même, qui se déclenche à chaque passage entre
  // enfants. On n'éteint l'overlay que quand le compteur retombe à 0.
  const enterCount = useRef(0);

  const hasFiles = useCallback((e: DragEvent) => {
    return Array.from(e.dataTransfer.types).includes("Files");
  }, []);

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      enterCount.current += 1;
      setActive(true);
    },
    [disabled, hasFiles]
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    [disabled, hasFiles]
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (disabled || !hasFiles(e)) return;
      enterCount.current = Math.max(0, enterCount.current - 1);
      if (enterCount.current === 0) setActive(false);
    },
    [disabled, hasFiles]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      enterCount.current = 0;
      setActive(false);
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => isAccepted(f, accept) && f.size <= maxBytes
      );
      if (files.length > 0) onFiles(files);
    },
    [disabled, hasFiles, accept, maxBytes, onFiles]
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative ${className ?? ""}`}
    >
      <span className="sr-only" aria-live="polite">
        {active ? "Déposez les fichiers pour les téléverser" : ""}
      </span>
      {children}
      {active && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary/60 bg-background/85 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <IconUpload className="size-7 text-primary" />
            <p className="font-heading text-base text-foreground">
              {overlayLabel}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {overlayHint}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
