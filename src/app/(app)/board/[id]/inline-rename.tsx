"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconPencil } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { updatePipelineMeta } from "../actions";

interface InlineRenameProps {
  pipelineId: string;
  initialName: string;
  description: string | null;
  /** Si le pipeline est un preset, on désactive l'édition. */
  editable: boolean;
}

/**
 * Titre inline éditable façon Notion/Linear : click → input auto-focus.
 * Enter = sauvegarder, Escape = annuler. La sauvegarde via Server Action
 * persiste + revalide la page. Aucun dialog requis pour renommer.
 */
export function InlineRename({
  pipelineId,
  initialName,
  description,
  editable,
}: InlineRenameProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialName);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync server-side renames into local state via render-time comparison
  // (React 19 pattern, évite l'effect setState).
  const [lastInitial, setLastInitial] = useState(initialName);
  if (initialName !== lastInitial) {
    setLastInitial(initialName);
    if (!editing) setValue(initialName);
  }

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing]);

  function commit() {
    const next = value.trim();
    if (!next || next === initialName) {
      setValue(initialName);
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await updatePipelineMeta(pipelineId, {
        name: next,
        description: description ?? null,
      });
      if (result.ok) {
        setEditing(false);
        router.refresh();
        toast.success("Pipeline renommée");
      } else {
        setValue(initialName);
        setEditing(false);
        toast.error("Renommage impossible", { description: result.error });
      }
    });
  }

  function cancel() {
    setValue(initialName);
    setEditing(false);
  }

  if (!editable) {
    return (
      <h1
        className="font-heading text-3xl md:text-4xl tracking-tight"
        title={`slug: ${pipelineId}`}
      >
        {initialName}
      </h1>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        disabled={pending}
        maxLength={120}
        aria-label="Renommer la pipeline"
        className={cn(
          "font-heading text-3xl md:text-4xl tracking-tight bg-transparent border-b-2 border-foreground/30 focus:border-foreground/60 outline-none px-0 py-0.5 w-full max-w-xl",
          pending && "opacity-50"
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group inline-flex items-center gap-2 font-heading text-3xl md:text-4xl tracking-tight text-left hover:opacity-90 transition-opacity"
      aria-label={`Renommer ${initialName}`}
    >
      {initialName}
      <IconPencil
        className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        aria-hidden
      />
    </button>
  );
}
