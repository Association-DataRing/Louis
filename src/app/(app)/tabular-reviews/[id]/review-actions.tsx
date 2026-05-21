"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  IconPlayerPlay,
  IconDots,
  IconTrash,
  IconRefresh,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { deleteTabularReview, runTabularReview } from "../actions";

type Props = {
  reviewId: string;
  pendingCount: number;
  totalRows: number;
};

export function ReviewActions({ reviewId, pendingCount, totalRows }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rerunOpen, setRerunOpen] = useState(false);

  function run() {
    startTransition(async () => {
      // L'action retourne dès que les lignes sont marquées "running" — le
      // traitement IA continue en arrière-plan. <AutoRefresh> rafraîchira
      // la page tant que des lignes seront en "running".
      await runTabularReview(reviewId);
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(() => deleteTabularReview(reviewId));
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={run}
        disabled={pending || pendingCount === 0 || totalRows === 0}
      >
        {pending ? (
          <Spinner className="size-4" />
        ) : (
          <IconPlayerPlay className="size-4" />
        )}
        {pending
          ? "Démarrage…"
          : pendingCount > 0
            ? `Lancer (${pendingCount})`
            : "Tout est traité"}
      </Button>
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
            disabled={pending || totalRows === 0}
            onSelect={() => setRerunOpen(true)}
          >
            <IconRefresh className="size-4" />
            Relancer l&apos;extraction
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <IconTrash className="size-4" />
            Supprimer l&apos;analyse
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDeleteDialog
        open={rerunOpen}
        onOpenChange={setRerunOpen}
        variant="default"
        title="Relancer l'extraction ?"
        description={
          <>
            Les lignes en attente ou en erreur seront re-soumises au modèle.
            Les lignes déjà extraites avec succès ne sont pas affectées.
          </>
        }
        actionLabel="Relancer"
        pendingLabel="Démarrage…"
        pending={pending}
        onConfirm={() => {
          setRerunOpen(false);
          run();
        }}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer cette analyse ?"
        description={
          <>
            Le tableau et toutes les valeurs extraites seront définitivement
            supprimés. Les documents originaux restent dans votre bibliothèque.
          </>
        }
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
