"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { IconAlertTriangle, IconX } from "@tabler/icons-react";
import { Dropzone, uploadDocument } from "@/components/dropzone";
import { Spinner } from "@/components/ui/spinner";

/**
 * Wrapper client de la page /documents. Délègue le drag-and-drop au composant
 * Dropzone partagé, fait l'upload via /api/documents/upload puis demande à
 * Next de re-rendre le server component parent (router.refresh) pour que la
 * liste reflète les nouveaux documents.
 */
export function DocumentsDropzone({
  folderId,
  children,
}: {
  folderId: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleDroppedFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setError(null);
      setUploadingCount((n) => n + files.length);
      let anySuccess = false;
      for (const file of files) {
        const result = await uploadDocument(file, { folderId });
        if (result.ok) {
          anySuccess = true;
        } else {
          setError(`${file.name} — ${result.error}`);
        }
        setUploadingCount((n) => Math.max(0, n - 1));
      }
      if (anySuccess) router.refresh();
    },
    [folderId, router]
  );

  return (
    <Dropzone
      onFiles={handleDroppedFiles}
      overlayLabel="Déposez pour importer dans ce dossier"
      overlayHint="PDF, DOCX ou texte — 25 Mo max par fichier"
    >
      {(uploadingCount > 0 || error) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          {uploadingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              <Spinner className="size-3" />
              Téléversement de {uploadingCount} fichier
              {uploadingCount > 1 ? "s" : ""}…
            </span>
          )}
          {error && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/5 px-2 py-0.5 text-destructive">
              <IconAlertTriangle className="size-3" />
              {error}
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-1 rounded-sm hover:bg-destructive/10 p-0.5"
                aria-label="Ignorer l'erreur"
              >
                <IconX className="size-3" />
              </button>
            </span>
          )}
        </div>
      )}
      {children}
    </Dropzone>
  );
}
