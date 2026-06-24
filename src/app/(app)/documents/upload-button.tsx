"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconUpload } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { uploadDocument } from "@/components/dropzone";

export function UploadButton({
  folderId = null,
}: {
  folderId?: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);

    // H16 : import multi-fichiers (l'input porte `multiple`). Upload
    // séquentiel — l'API fait extraction + embedding synchrones, le
    // parallélisme saturerait le provider d'embedding.
    startTransition(async () => {
      let failed = 0;
      for (const file of files) {
        const r = await uploadDocument(file, { folderId });
        if (!r.ok) failed += 1;
      }
      if (fileRef.current) fileRef.current.value = "";
      if (failed > 0) {
        setError(
          `${failed} fichier${failed > 1 ? "s" : ""} sur ${files.length} n'${
            failed > 1 ? "ont" : "a"
          } pas pu être importé${failed > 1 ? "s" : ""}.`
        );
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        onClick={() => fileRef.current?.click()}
        disabled={pending}
      >
        {pending ? <Spinner className="size-4" /> : <IconUpload className="size-4" />}
        {pending ? "Envoi…" : "Importer"}
      </Button>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="sr-only"
        onChange={onChange}
      />
      {error && (
        <p className="text-xs text-destructive max-w-xs text-right">{error}</p>
      )}
    </div>
  );
}
