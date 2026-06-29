"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  IconPlayerPlay,
  IconDots,
  IconTrash,
  IconRefresh,
  IconFileSpreadsheet,
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
  const t = useTranslations("tabularReviews");
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
          ? t("actions.starting")
          : pendingCount > 0
            ? t("actions.runCount", { count: pendingCount })
            : t("actions.allProcessed")}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="size-9 inline-flex items-center justify-center rounded-md border border-border hover:bg-accent transition-colors"
          aria-label={t("actions.actionsAria")}
          disabled={pending}
        >
          <IconDots className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={totalRows === 0}
            onSelect={() => {
              // Route GET attachment → le navigateur télécharge et reste sur
              // la page.
              window.location.href = `/api/tabular-reviews/${reviewId}/export`;
            }}
          >
            <IconFileSpreadsheet className="size-4" />
            {t("actions.exportCsv")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={pending || totalRows === 0}
            onSelect={() => setRerunOpen(true)}
          >
            <IconRefresh className="size-4" />
            {t("actions.rerunExtraction")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <IconTrash className="size-4" />
            {t("actions.deleteReview")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDeleteDialog
        open={rerunOpen}
        onOpenChange={setRerunOpen}
        variant="default"
        title={t("actions.rerunTitle")}
        description={t("actions.rerunDescription")}
        actionLabel={t("actions.rerunAction")}
        pendingLabel={t("actions.rerunPending")}
        pending={pending}
        onConfirm={() => {
          setRerunOpen(false);
          run();
        }}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("actions.deleteTitle")}
        description={t("actions.deleteDescription")}
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
