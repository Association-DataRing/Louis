"use client";

import { useTransition } from "react";
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
import { deleteTabularReview, runTabularReview } from "../actions";

type Props = {
  reviewId: string;
  pendingCount: number;
  totalRows: number;
};

export function ReviewActions({ reviewId, pendingCount, totalRows }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      await runTabularReview(reviewId);
      router.refresh();
    });
  }

  function handleDelete() {
    if (
      !confirm(
        "Supprimer cette analyse ? Les valeurs extraites seront perdues. Les documents originaux sont conservés."
      )
    )
      return;
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
          ? "Extraction…"
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
            onSelect={() => {
              if (
                confirm(
                  "Relancer l'extraction sur les lignes en erreur ou en attente ?"
                )
              )
                run();
            }}
          >
            <IconRefresh className="size-4" />
            Relancer l&apos;extraction
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
            <IconTrash className="size-4" />
            Supprimer l&apos;analyse
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
