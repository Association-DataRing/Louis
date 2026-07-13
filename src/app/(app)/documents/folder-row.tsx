"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  IconDots,
  IconFolder,
  IconPencil,
  IconTrash,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import type { DocumentFolder } from "@/db/schema";
import { deleteFolder, renameFolder } from "./actions";

export function FolderRow({
  folder,
  subfolderCount = 0,
}: {
  folder: DocumentFolder;
  /** Nombre de sous-dossiers (récursif) supprimés en cascade (H20). */
  subfolderCount?: number;
}) {
  const router = useRouter();
  const t = useTranslations("documents.folder");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(folder.name);
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  function commitRename() {
    const next = draft.trim();
    if (!next || next === folder.name) {
      setEditing(false);
      setDraft(folder.name);
      return;
    }
    startTransition(async () => {
      await renameFolder(folder.id, next);
      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteFolder(folder.id);
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="px-5 py-4 flex items-center gap-4">
      <div className="shrink-0 size-10 rounded-md bg-muted flex items-center justify-center text-foreground">
        <IconFolder className="size-5 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              aria-label={t("renameAria")}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setEditing(false);
                  setDraft(folder.name);
                }
              }}
              className="flex-1 bg-transparent border border-input rounded-md px-2 py-1 text-sm outline-none focus:border-ring"
            />
            <button
              type="button"
              onClick={commitRename}
              className="size-8 inline-flex items-center justify-center rounded-md text-primary hover:bg-accent"
              title={t("validate")}
              aria-label={t("validate")}
            >
              <IconCheck className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(folder.name);
              }}
              className="size-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              title={t("cancel")}
              aria-label={t("cancel")}
            >
              <IconX className="size-4" />
            </button>
          </div>
        ) : (
          <Link
            href={`/documents?folder=${folder.id}`}
            className="font-medium truncate hover:underline underline-offset-2"
          >
            {folder.name}
          </Link>
        )}
        <div className="text-xs text-muted-foreground mt-0.5">
          {t("createdAt", {
            date: new Date(folder.createdAt).toLocaleDateString("fr-FR"),
          })}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="size-8 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors disabled:opacity-50"
          aria-label={t("actionsAria")}
          disabled={pending}
        >
          <IconDots className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <IconPencil className="size-4" />
            {t("rename")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <IconTrash className="size-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteTitle")}
        description={t("deleteDescription", {
          count: subfolderCount,
          name: folder.name,
        })}
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
