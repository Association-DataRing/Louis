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
import { deleteProject, updateProject } from "../actions";

type Props = {
  id: string;
  name: string;
  description: string | null;
};

export function ProjectActions({ id, name, description }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);
  const [descDraft, setDescDraft] = useState(description ?? "");
  const [pending, startTransition] = useTransition();

  function handleEdit(formData: FormData) {
    const next = (formData.get("name") as string)?.trim();
    if (!next) return;
    const nextDesc = (formData.get("description") as string) ?? "";
    startTransition(async () => {
      await updateProject(id, next, nextDesc);
      setEditOpen(false);
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
              setNameDraft(name);
              setDescDraft(description ?? "");
              setEditOpen(true);
            }}
          >
            <IconPencil className="size-4" />
            Modifier
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              Modifier le projet
            </DialogTitle>
            <DialogDescription>
              Le nom est visible partout (sidebar, liste des projets, etc.).
            </DialogDescription>
          </DialogHeader>
          <form action={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom</Label>
              <Input
                id="edit-name"
                name="name"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                required
                maxLength={80}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">
                Description{" "}
                <span className="text-[10px] text-muted-foreground font-normal">
                  (optionnel)
                </span>
              </Label>
              <Input
                id="edit-description"
                name="description"
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                maxLength={500}
                placeholder="Note interne, n° dossier, partie adverse…"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Enregistrement…" : "Enregistrer"}
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
