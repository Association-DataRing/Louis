"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  IconDots,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import type { Workflow } from "@/db/schema";
import { deleteWorkflow, updateWorkflow } from "./actions";

export function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const router = useRouter();
  const t = useTranslations("workflows");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleEdit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateWorkflow(workflow.id, null, formData);
      if (result.ok) {
        setEditOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteWorkflow(workflow.id);
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <li>
      <div className="py-5 flex items-start gap-6">
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-lg tracking-tight">
            {workflow.name}
          </h3>
          {workflow.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {workflow.description}
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground line-clamp-2 max-w-2xl">
            {workflow.prompt}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="size-10 shrink-0 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors disabled:opacity-50"
            aria-label={t("card.actionsAria")}
            disabled={pending}
          >
            <IconDots className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <IconPencil className="size-4" />
              {t("card.edit")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              <IconTrash className="size-4" />
              {t("card.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {t("card.editTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("card.editDescription")}
            </DialogDescription>
          </DialogHeader>
          <form action={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`name-${workflow.id}`}>{t("card.nameLabel")}</Label>
              <Input
                id={`name-${workflow.id}`}
                name="name"
                defaultValue={workflow.name}
                required
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`description-${workflow.id}`}>{t("card.descriptionLabel")}</Label>
              <Input
                id={`description-${workflow.id}`}
                name="description"
                defaultValue={workflow.description ?? ""}
                maxLength={300}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`prompt-${workflow.id}`}>{t("card.promptLabel")}</Label>
              <textarea
                id={`prompt-${workflow.id}`}
                name="prompt"
                defaultValue={workflow.prompt}
                required
                maxLength={4000}
                rows={6}
                className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditOpen(false)}
              >
                {t("card.cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t("card.saving") : t("card.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("card.deleteTitle")}
        description={t("card.deleteDescription", { name: workflow.name })}
        pending={pending}
        onConfirm={handleDelete}
      />
    </li>
  );
}
