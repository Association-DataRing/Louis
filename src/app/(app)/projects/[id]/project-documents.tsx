"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconFileText,
  IconUpload,
  IconAlertTriangle,
  IconX,
} from "@tabler/icons-react";
import { Dropzone, uploadDocument } from "@/components/dropzone";
import { Spinner } from "@/components/ui/spinner";

type Doc = {
  id: string;
  filename: string;
  createdAt: Date | string;
};

const ACCEPT =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

export function ProjectDocuments({
  folderId,
  docs,
}: {
  folderId: string | null;
  docs: Doc[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setError(null);
      setUploadingCount((n) => n + files.length);
      let anySuccess = false;
      for (const file of files) {
        const result = await uploadDocument(file, { folderId });
        if (result.ok) anySuccess = true;
        else setError(`${file.name} — ${result.error}`);
        setUploadingCount((n) => Math.max(0, n - 1));
      }
      if (anySuccess) router.refresh();
    },
    [folderId, router]
  );

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = "";
    upload(files);
  }

  const busy = uploadingCount > 0;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-lg tracking-tight inline-flex items-center gap-2">
          <IconFileText className="size-4 text-muted-foreground" aria-hidden />
          Documents
          <span className="text-xs text-muted-foreground font-normal">
            ({docs.length})
          </span>
        </h2>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2 disabled:opacity-50"
        >
          {busy ? (
            <Spinner className="size-3" />
          ) : (
            <IconUpload className="size-3" />
          )}
          {busy ? "Envoi…" : "Importer un document"}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={onPick}
      />

      {error && (
        <div
          role="alert"
          className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/5 px-2 py-0.5 text-xs text-destructive"
        >
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
        </div>
      )}

      <Dropzone
        onFiles={upload}
        disabled={busy}
        overlayLabel="Déposez pour ajouter à ce projet"
        overlayHint="PDF, DOCX ou texte — 25 Mo max par fichier"
      >
        {docs.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-6 text-sm text-muted-foreground">
            Glissez vos pièces ici, ou importez-les — elles seront rattachées à
            ce dossier.
          </div>
        ) : (
          <ul
            role="list"
            className="border border-border rounded-lg bg-card divide-y divide-border"
          >
            {docs.map((d) => (
              <li key={d.id}>
                <a
                  href={`/api/documents/${d.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors"
                >
                  <IconFileText
                    className="size-3.5 text-muted-foreground shrink-0"
                    aria-hidden
                  />
                  <span className="text-sm truncate flex-1 min-w-0">
                    {d.filename}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {new Date(d.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {busy && (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          >
            <Spinner className="size-3" />
            Téléversement de {uploadingCount} fichier
            {uploadingCount > 1 ? "s" : ""}…
          </div>
        )}
      </Dropzone>
    </section>
  );
}
