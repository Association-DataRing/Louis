"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  IconDots,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import type { ReviewColumn, ReviewColumnFormat } from "@/db/schema";
import {
  updateReviewColumn,
  deleteReviewColumn,
  rerunReviewColumn,
} from "../actions";

const FORMAT_KEYS: ReviewColumnFormat[] = [
  "text",
  "bulleted_list",
  "date",
  "money",
  "boolean",
];

type Props = {
  reviewId: string;
  column: ReviewColumn;
};

/**
 * Popover « Modifier la colonne » accroché au bouton ... du header d'une
 * colonne d'analyse tabulaire. Permet d'éditer libellé / format / prompt
 * sans quitter la grille, et de supprimer la colonne via une AlertDialog
 * de confirmation.
 *
 * Note : la modification du prompt n'invalide pas automatiquement les
 * valeurs déjà extraites. À l'utilisateur de relancer l'extraction via
 * le bouton « Relancer » global du header de la page si nécessaire.
 */
export function ColumnEditPopover({ reviewId, column }: Props) {
  const router = useRouter();
  const t = useTranslations("tabularReviews");
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [label, setLabel] = useState(column.label);
  const [prompt, setPrompt] = useState(column.prompt);
  const [format, setFormat] = useState<ReviewColumnFormat>(
    column.format ?? "text"
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateReviewColumn(reviewId, column.id, {
        label: label.trim(),
        prompt: prompt.trim(),
        format,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
      toast.success(t("columnEdit.toastUpdated"), { description: label.trim() });
    });
  }

  function handleSaveAndRerun() {
    setError(null);
    startTransition(async () => {
      const saved = await updateReviewColumn(reviewId, column.id, {
        label: label.trim(),
        prompt: prompt.trim(),
        format,
      });
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      const rerun = await rerunReviewColumn(reviewId, column.id);
      if (!rerun.ok) {
        setError(rerun.error);
        return;
      }
      setOpen(false);
      router.refresh();
      toast.success(t("columnEdit.toastSavedRerun"), {
        description: label.trim(),
      });
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteReviewColumn(reviewId, column.id);
      if (!result.ok) {
        toast.error(t("columnEdit.toastDeleteError"), { description: result.error });
        return;
      }
      setDeleteOpen(false);
      setOpen(false);
      router.refresh();
      toast.success(t("columnEdit.toastDeleted"));
    });
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          asChild
          aria-label={t("columnEdit.editColumnAria", { label: column.label })}
        >
          <button
            type="button"
            className="inline-flex items-center justify-center size-6 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <IconDots className="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={6}
          className="w-80 p-3"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="font-heading text-sm tracking-tight">
              {t("columnEdit.heading")}
            </p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`label-${column.id}`} className="text-xs">
                {t("columnEdit.labelLabel")}
              </Label>
              <Input
                id={`label-${column.id}`}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={80}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`format-${column.id}`} className="text-xs">
                {t("columnEdit.formatLabel")}
              </Label>
              <Select
                value={format}
                onValueChange={(v) => setFormat(v as ReviewColumnFormat)}
              >
                <SelectTrigger
                  id={`format-${column.id}`}
                  size="sm"
                  className="h-8 text-sm w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`columnEdit.formats.${k}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`prompt-${column.id}`} className="text-xs">
                {t("columnEdit.promptLabel")}
              </Label>
              <textarea
                id={`prompt-${column.id}`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={500}
                rows={4}
                className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm leading-snug focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              />
              <p className="text-[10px] text-muted-foreground">
                {t("columnEdit.promptHint")}
              </p>
            </div>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={pending}
              className="inline-flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
            >
              <IconTrash className="size-3.5" />
              {t("columnEdit.deleteColumn")}
            </button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSave}
                disabled={pending || !label.trim() || !prompt.trim()}
              >
                {t("columnEdit.save")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveAndRerun}
                disabled={pending || !label.trim() || !prompt.trim()}
                title={t("columnEdit.rerunButtonTitle")}
              >
                {pending ? t("columnEdit.rerunSaving") : t("columnEdit.rerun")}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("columnEdit.deleteConfirmTitle")}
        description={t("columnEdit.deleteConfirmDescription", { label: column.label })}
        pending={pending}
        onConfirm={handleDelete}
      />
    </>
  );
}
