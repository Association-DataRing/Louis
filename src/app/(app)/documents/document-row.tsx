"use client";

import { useTransition } from "react";
import {
  IconDots,
  IconFile,
  IconFileTypePdf,
  IconFileTypeDocx,
  IconAlertTriangle,
  IconTrash,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Document } from "@/db/schema/documents";
import { deleteDocument } from "./actions";

export function DocumentRow({ entry }: { entry: Document }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="px-5 py-4 flex items-center gap-4">
      <div className="shrink-0 size-10 rounded-md bg-muted flex items-center justify-center text-foreground">
        <FileIcon contentType={entry.contentType} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{entry.filename}</span>
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
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {formatBytes(entry.sizeBytes)} ·{" "}
          {new Date(entry.createdAt).toLocaleDateString("fr-FR")}
          {entry.extractedText && (
            <> · {Math.round(entry.extractedText.length / 1000)}k caractères</>
          )}
        </div>
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
