"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { updateReviewColumn, deleteReviewColumn } from "../actions";

const FORMAT_LABELS: Record<ReviewColumnFormat, string> = {
  text: "Texte",
  bulleted_list: "Liste à puces",
  date: "Date",
  money: "Montant",
  boolean: "Oui / Non",
};

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
      toast.success("Colonne mise à jour", { description: label.trim() });
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteReviewColumn(reviewId, column.id);
      if (!result.ok) {
        toast.error("Suppression impossible", { description: result.error });
        return;
      }
      setDeleteOpen(false);
      setOpen(false);
      router.refresh();
      toast.success("Colonne supprimée");
    });
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          asChild
          aria-label={`Modifier la colonne ${column.label}`}
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
              Modifier la colonne
            </p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`label-${column.id}`} className="text-xs">
                Libellé
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
                Format
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
                  {(Object.keys(FORMAT_LABELS) as ReviewColumnFormat[]).map(
                    (k) => (
                      <SelectItem key={k} value={k}>
                        {FORMAT_LABELS[k]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`prompt-${column.id}`} className="text-xs">
                Prompt
              </Label>
              <textarea
                id={`prompt-${column.id}`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={500}
                rows={4}
                className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <p className="text-[10px] text-muted-foreground">
                Décrivez ce que Louis doit extraire — l&apos;instruction est
                envoyée au modèle pour chaque document de l&apos;analyse.
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
              Supprimer
            </button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={pending || !label.trim() || !prompt.trim()}
              >
                {pending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer cette colonne ?"
        description={
          <>
            « {column.label} » sera retirée de l&apos;analyse. Les valeurs
            extraites pour cette colonne dans toutes les lignes seront
            définitivement perdues.
          </>
        }
        pending={pending}
        onConfirm={handleDelete}
      />
    </>
  );
}
