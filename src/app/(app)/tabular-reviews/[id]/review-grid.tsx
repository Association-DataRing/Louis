"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  IconCheck,
  IconAlertTriangle,
  IconClock,
  IconTrash,
  IconRefresh,
} from "@tabler/icons-react";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { ColumnEditPopover } from "./column-edit-popover";
import type { ReviewColumn, TabularReviewRow } from "@/db/schema";
import { deleteReviewRow, rerunReviewRow } from "../actions";

type Row = TabularReviewRow & { filename: string };

type Props = {
  columns: ReviewColumn[];
  rows: Row[];
  reviewId: string;
};

export function ReviewGrid({ columns, rows, reviewId }: Props) {
  const t = useTranslations("tabularReviews");
  if (rows.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-10 text-center">
        <p className="text-sm text-muted-foreground">
          {t("grid.emptyNoRows")}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop : grille type Excel — colonnes = champs extraits */}
      <div className="hidden md:block border border-border rounded-lg overflow-hidden bg-card">
        {/* Table en lecture seule, présentationnelle : pas de tri ni de
            navigation clavier cellule par cellule (aria-sort / grid nav non
            requis pour un tableau statique). */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{t("grid.caption")}</caption>
            <thead className="bg-muted/40">
              <tr>
                <th
                  scope="col"
                  className="text-left font-medium px-4 py-2.5 border-b border-border sticky left-0 bg-muted/40 min-w-[200px]"
                >
                  {t("grid.colDocument")}
                </th>
                <th
                  scope="col"
                  className="text-center font-medium px-3 py-2.5 border-b border-border w-[80px]"
                >
                  {t("grid.colStatus")}
                </th>
                {columns.map((c) => (
                  <th
                    key={c.id}
                    scope="col"
                    className="text-left font-medium px-4 py-2.5 border-b border-border min-w-[200px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate" title={c.prompt}>
                        {c.label}
                      </span>
                      <ColumnEditPopover
                        reviewId={reviewId}
                        column={c}
                      />
                    </div>
                  </th>
                ))}
                <th className="w-[40px] border-b border-border"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <RowItem key={r.id} columns={columns} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile : cards empilées — un document par carte, champs en
          définition list. Pas de scroll horizontal. */}
      <div className="md:hidden space-y-3">
        {rows.map((r) => (
          <RowCard key={r.id} columns={columns} row={r} />
        ))}
      </div>
    </>
  );
}

function RowCard({ row, columns }: { row: Row; columns: ReviewColumn[] }) {
  const router = useRouter();
  const t = useTranslations("tabularReviews");
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  function rerun() {
    startTransition(async () => {
      await rerunReviewRow(row.id);
      router.refresh();
    });
  }

  return (
    <article className="border border-border rounded-lg bg-card overflow-hidden">
      <header className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{row.filename}</p>
          <div className="mt-1">
            <StatusBadge status={row.status} error={row.error} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={pending || row.status === "running"}
            onClick={rerun}
            className="size-10 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
            aria-label={t("grid.rerunRow")}
          >
            <IconRefresh className="size-4" />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setDeleteOpen(true)}
            className="size-10 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label={t("grid.removeRow")}
          >
            <IconTrash className="size-4" />
          </button>
        </div>
      </header>
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("grid.removeTitle")}
        description={t("grid.removeDescription", { filename: row.filename })}
        actionLabel={t("grid.removeAction")}
        pendingLabel={t("grid.removePending")}
        pending={pending}
        onConfirm={() => {
          startTransition(async () => {
            await deleteReviewRow(row.id);
            setDeleteOpen(false);
          });
        }}
      />
      <dl className="px-4 py-3 space-y-2.5">
        {columns.map((c) => {
          const value = row.values?.[c.id];
          return (
            <div key={c.id}>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {c.label}
              </dt>
              <dd className="mt-0.5 text-xs leading-relaxed">
                {value ? (
                  <span>{value}</span>
                ) : (
                  <span className="text-muted-foreground italic">—</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </article>
  );
}

function RowItem({ row, columns }: { row: Row; columns: ReviewColumn[] }) {
  const router = useRouter();
  const t = useTranslations("tabularReviews");
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  function rerun() {
    startTransition(async () => {
      await rerunReviewRow(row.id);
      router.refresh();
    });
  }

  return (
    <tr className="border-b border-border last:border-0 hover:bg-accent/20">
      <th
        scope="row"
        className="font-normal text-left px-4 py-2.5 truncate max-w-xs sticky left-0 bg-card"
      >
        {row.filename}
      </th>
      <td className="px-3 py-2.5 text-center">
        <StatusBadge status={row.status} error={row.error} />
      </td>
      {columns.map((c) => {
        const value = row.values?.[c.id];
        return (
          <td
            key={c.id}
            className="px-4 py-2.5 align-top max-w-xs text-xs leading-relaxed whitespace-normal break-words"
          >
            {value ? (
              <span className="text-foreground">{value}</span>
            ) : (
              <span className="text-muted-foreground italic">—</span>
            )}
          </td>
        );
      })}
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            disabled={pending || row.status === "running"}
            onClick={rerun}
            className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
            aria-label={t("grid.rerunRow")}
            title={t("grid.rerunRow")}
          >
            <IconRefresh className="size-3.5" />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setDeleteOpen(true)}
            className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label={t("grid.removeRow")}
          >
            <IconTrash className="size-3.5" />
          </button>
        </div>
        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={t("grid.removeTitle")}
          description={t("grid.removeDescription", { filename: row.filename })}
          actionLabel={t("grid.removeAction")}
          pendingLabel={t("grid.removePending")}
          pending={pending}
          onConfirm={() => {
            startTransition(async () => {
              await deleteReviewRow(row.id);
              setDeleteOpen(false);
            });
          }}
        />
      </td>
    </tr>
  );
}

function StatusBadge({
  status,
  error,
}: {
  status: string;
  error: string | null;
}) {
  const t = useTranslations("tabularReviews");
  if (status === "pending") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs bg-muted text-muted-foreground"
        title={t("grid.statusPending")}
        aria-label={t("grid.statusPending")}
      >
        <IconClock className="size-3" />
        {t("grid.statusPending")}
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs bg-primary/10 text-primary">
        <Spinner className="size-3" />
        {t("grid.statusRunning")}
      </span>
    );
  }
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs bg-success/10 text-success">
        <IconCheck className="size-3" />
        {t("grid.statusOk")}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs bg-destructive/10 text-destructive"
      title={error ?? undefined}
      aria-label={error ?? t("grid.statusError")}
    >
      <IconAlertTriangle className="size-3" />
      {t("grid.statusError")}
    </span>
  );
}
