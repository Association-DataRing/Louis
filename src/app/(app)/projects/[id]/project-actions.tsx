"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("projects.actions");
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
          aria-label={t("actionsAria")}
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
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <IconTrash className="size-4" />
            {t("deleteProject")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {t("editTitle")}
            </DialogTitle>
            <DialogDescription>{t("editDescription")}</DialogDescription>
          </DialogHeader>
          <form action={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t("nameLabel")}</Label>
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
                {t("descriptionLabel")}{" "}
                <span className="text-[10px] text-muted-foreground font-normal">
                  {t("optional")}
                </span>
              </Label>
              <Input
                id="edit-description"
                name="description"
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                maxLength={500}
                placeholder={t("descriptionPlaceholder")}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t("saving") : t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteTitle")}
        description={t("deleteDescription", { name })}
        pending={pending}
        onConfirm={handleDelete}
      />
    </>
  );
}
