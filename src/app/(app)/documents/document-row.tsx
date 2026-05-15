"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  IconDots,
  IconFile,
  IconFileTypePdf,
  IconFileTypeDocx,
  IconAlertTriangle,
  IconTrash,
  IconFolders,
  IconFolderOff,
  IconCheck,
  IconChevronRight,
  IconChevronDown,
  IconVersions,
  IconHistory,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Document } from "@/db/schema/documents";
import { deleteDocument } from "./actions";
import { moveDocumentToProject } from "../projects/actions";

type Props = {
  entry: Document;
  projects?: { id: string; name: string }[];
  /** Older revisions (v1, v2…) of the same family, oldest first. */
  versions?: Document[];
};

export function DocumentRow({ entry, projects = [], versions = [] }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const replaceRef = useRef<HTMLInputElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  function moveTo(projectId: string | null) {
    startTransition(async () => {
      await moveDocumentToProject(entry.id, projectId);
      router.refresh();
    });
  }

  function onReplaceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplaceError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("replaces", entry.id);
    startTransition(async () => {
      try {
        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          setReplaceError(await res.text());
          return;
        }
        if (replaceRef.current) replaceRef.current.value = "";
        router.refresh();
      } catch (err) {
        setReplaceError(err instanceof Error ? err.message : "Erreur réseau.");
      }
    });
  }

  const hasHistory = versions.length > 0;

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-4">
      <div className="shrink-0 size-10 rounded-md bg-muted flex items-center justify-center text-foreground">
        <FileIcon contentType={entry.contentType} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{entry.filename}</span>
          {entry.version > 1 && (
            <Badge variant="outline" className="shrink-0 text-[10px] gap-1">
              <IconVersions className="size-2.5" />v{entry.version}
            </Badge>
          )}
          {entry.extractionStatus === "truncated" && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              tronqué
            </Badge>
          )}
          {entry.extractionStatus === "failed" && (
            <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
              <IconAlertTriangle className="size-3" />
              extraction échouée
            </span>
          )}
          {entry.projectId && (
            <Badge variant="secondary" className="shrink-0 text-[10px] gap-1">
              <IconFolders className="size-2.5" />
              {projects.find((p) => p.id === entry.projectId)?.name ?? "projet"}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {formatBytes(entry.sizeBytes)} ·{" "}
          {new Date(entry.createdAt).toLocaleDateString("fr-FR")}
          {entry.extractedText && (
            <> · {Math.round(entry.extractedText.length / 1000)}k caractères</>
          )}
        </div>
        {entry.extractionError && (
          <div
            className="text-xs text-destructive mt-1 truncate"
            title={entry.extractionError}
          >
            {entry.extractionError}
          </div>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="size-8 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors"
          aria-label="Actions"
        >
          <IconDots className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={pending}
            onSelect={() => replaceRef.current?.click()}
          >
            <IconVersions className="size-4" />
            Uploader nouvelle version
          </DropdownMenuItem>
          {hasHistory && (
            <DropdownMenuItem onSelect={() => setHistoryOpen((v) => !v)}>
              <IconHistory className="size-4" />
              {historyOpen ? "Masquer l'historique" : `Historique (${versions.length})`}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {projects.length > 0 && (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <IconFolders className="size-4" />
                  Déplacer vers
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {entry.projectId && (
                    <>
                      <DropdownMenuItem onSelect={() => moveTo(null)}>
                        <IconFolderOff className="size-4" />
                        Retirer du projet
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {projects.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onSelect={() => moveTo(p.id)}
                      disabled={p.id === entry.projectId}
                    >
                      {p.id === entry.projectId ? (
                        <IconCheck className="size-4 text-primary" />
                      ) : (
                        <IconFolders className="size-4" />
                      )}
                      <span className="truncate">{p.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onSelect={() => {
              if (confirm(`Supprimer "${entry.filename}" ?`)) {
                startTransition(() => deleteDocument(entry.id));
              }
            }}
          >
            <IconTrash className="size-4" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>

      <input
        ref={replaceRef}
        type="file"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="hidden"
        onChange={onReplaceChange}
      />
      {replaceError && (
        <p className="mt-2 text-xs text-destructive">{replaceError}</p>
      )}

      {hasHistory && (
        <div className="mt-3 ml-14">
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {historyOpen ? (
              <IconChevronDown className="size-3" />
            ) : (
              <IconChevronRight className="size-3" />
            )}
            <IconHistory className="size-3" />
            {versions.length} version{versions.length > 1 ? "s" : ""} antérieure{versions.length > 1 ? "s" : ""}
          </button>
          {historyOpen && (
            <ul className="mt-2 space-y-1 border-l border-border pl-3">
              {[...versions]
                .sort((a, b) => b.version - a.version)
                .map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Badge variant="outline" className="text-[10px]">
                      v{v.version}
                    </Badge>
                    <span className="truncate">{v.filename}</span>
                    <span className="text-[10px]">
                      {new Date(v.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function FileIcon({ contentType }: { contentType: string }) {
  if (contentType === "application/pdf") return <IconFileTypePdf className="size-5" />;
  if (contentType.includes("wordprocessingml")) return <IconFileTypeDocx className="size-5" />;
  return <IconFile className="size-5" />;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}
