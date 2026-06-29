"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("documents.dropzone");
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
      onRejected={(rejected) => {
        const types = rejected.filter((r) => r.reason === "type").length;
        const sizes = rejected.filter((r) => r.reason === "size").length;
        const parts: string[] = [];
        if (types) parts.push(t("rejectedTypes", { count: types }));
        if (sizes) parts.push(t("rejectedSizes", { count: sizes }));
        setError(
          t("rejectedSummary", {
            count: rejected.length,
            detail: parts.join(" · "),
          })
        );
      }}
      overlayLabel={t("overlayLabel")}
      overlayHint={t("overlayHint")}
    >
      {(uploadingCount > 0 || error) && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 flex flex-wrap items-center gap-2 text-xs"
        >
          {uploadingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              <Spinner className="size-3" />
              {t("uploading", { count: uploadingCount })}
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
                aria-label={t("dismissError")}
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
