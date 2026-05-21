"use client";

import { useState, useTransition } from "react";
import {
  IconDots,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { deleteProject, renameProject } from "../actions";

type Props = {
  id: string;
  name: string;
  description: string | null;
};

export function ProjectActions({ id, name }: Props) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const [pending, startTransition] = useTransition();

  function handleRename(formData: FormData) {
    const next = (formData.get("name") as string)?.trim();
    if (!next) return;
    startTransition(async () => {
      await renameProject(id, next);
      setRenameOpen(false);
    });
  }

  function handleDelete() {
    startTransition(() => deleteProject(id));
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="size-9 inline-flex items-center justify-center rounded-md border border-border hover:bg-accent transition-colors"
          aria-label="Actions"
          disabled={pending}
        >
          <IconDots className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setDraft(name);
              setRenameOpen(true);
            }}
          >
            <IconPencil className="size-4" />
            Renommer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <IconTrash className="size-4" />
            Supprimer le projet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              Renommer le projet
            </DialogTitle>
            <DialogDescription>
              Le nouveau nom sera visible partout (sidebar, liste des projets,
              etc.).
            </DialogDescription>
          </DialogHeader>
          <form action={handleRename} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-name">Nom</Label>
              <Input
                id="rename-name"
                name="name"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                required
                maxLength={80}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRenameOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer ce projet ?"
        description={
          <>
            « {name} » sera supprimé. Les conversations et documents seront
            détachés mais conservés — vous les retrouverez dans leur emplacement
            d&apos;origine.
          </>
        }
        pending={pending}
        onConfirm={handleDelete}
      />
    </>
  );
}
