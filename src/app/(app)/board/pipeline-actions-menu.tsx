"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  IconCopy,
  IconDots,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Pipeline } from "@/db/schema";
import {
  clonePipeline,
  deletePipeline,
  updatePipelineMeta,
} from "./actions";

interface PipelineActionsMenuProps {
  pipeline: Pipeline;
}

export function PipelineActionsMenu({ pipeline }: PipelineActionsMenuProps) {
  const router = useRouter();
  const t = useTranslations("board");
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(pipeline.name);
  const [description, setDescription] = useState(pipeline.description ?? "");

  function handleClone() {
    setError(null);
    startTransition(async () => {
      const result = await clonePipeline(pipeline.id);
      if (result.ok) {
        router.refresh();
        toast.success(t("pipelineActions.cloned"));
      } else {
        setError(result.error);
        toast.error(t("pipelineActions.cloneError"), { description: result.error });
      }
    });
  }

  function handleDeleteConfirmed() {
    startTransition(async () => {
      const result = await deletePipeline(pipeline.id);
      if (result.ok) {
        setDeleteOpen(false);
        router.refresh();
        toast.success(t("pipelineActions.deleted"));
      } else {
        setError(result.error);
        toast.error(t("pipelineActions.deleteError"), { description: result.error });
      }
    });
  }

  function handleRenameSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await updatePipelineMeta(pipeline.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      if (result.ok) {
        setRenameOpen(false);
        router.refresh();
        toast.success(t("pipelineActions.updated"));
      } else {
        setError(result.error);
        toast.error(t("pipelineActions.updateError"), { description: result.error });
      }
    });
  }

  const isPreset = pipeline.isPreset;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="size-9 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors disabled:opacity-50"
          aria-label={t("pipelineActions.menuAria")}
          disabled={pending}
          onClick={(e) => {
            // Empêche la propagation au <Link> parent quand ce menu est
            // rendu à l'intérieur d'une carte cliquable (/board index).
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <IconDots className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleClone}>
            <IconCopy className="size-4" />
            {t("pipelineActions.clone")}
          </DropdownMenuItem>
          {!isPreset && (
            <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
              <IconPencil className="size-4" />
              {t("pipelineActions.rename")}
            </DropdownMenuItem>
          )}
          {!isPreset && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setDeleteOpen(true)}
              >
                <IconTrash className="size-4" />
                {t("pipelineActions.delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("pipelineActions.deleteTitle", { name: pipeline.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("pipelineActions.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? t("pipelineActions.deleting") : t("pipelineActions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {t("pipelineActions.renameTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("pipelineActions.renameDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`pname-${pipeline.id}`}>
                {t("pipelineActions.nameLabel")}
              </Label>
              <Input
                id={`pname-${pipeline.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pdesc-${pipeline.id}`}>
                {t("pipelineActions.descriptionLabel")}
              </Label>
              <Input
                id={`pdesc-${pipeline.id}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRenameOpen(false)}
              disabled={pending}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleRenameSubmit} disabled={pending}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
