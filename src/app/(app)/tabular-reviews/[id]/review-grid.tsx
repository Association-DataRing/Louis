"use client";

import { useState, useTransition } from "react";
import {
  IconCheck,
  IconAlertTriangle,
  IconClock,
  IconTrash,
} from "@tabler/icons-react";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { ColumnEditPopover } from "./column-edit-popover";
import type { ReviewColumn, TabularReviewRow } from "@/db/schema";
import { deleteReviewRow } from "../actions";

type Row = TabularReviewRow & { filename: string };

type Props = {
  columns: ReviewColumn[];
  rows: Row[];
  reviewId: string;
};

export function ReviewGrid({ columns, rows, reviewId }: Props) {
  if (rows.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Aucun document n&apos;a été ajouté à cette analyse. Recréez une
          analyse en sélectionnant des documents.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop : grille type Excel — colonnes = champs extraits */}
      <div className="hidden md:block border border-border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left font-medium px-4 py-2.5 border-b border-border sticky left-0 bg-muted/40 min-w-[200px]">
                  Document
                </th>
                <th className="text-center font-medium px-3 py-2.5 border-b border-border w-[80px]">
                  Statut
                </th>
                {columns.map((c) => (
                  <th
                    key={c.id}
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
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <article className="border border-border rounded-lg bg-card overflow-hidden">
      <header className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{row.filename}</p>
          <div className="mt-1">
            <StatusBadge status={row.status} error={row.error} />
          </div>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => setDeleteOpen(true)}
          className="size-10 shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label="Retirer"
        >
          <IconTrash className="size-4" />
        </button>
      </header>
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Retirer ce document de l'analyse ?"
        description={
          <>
            « {row.filename} » sera retiré du tableau d&apos;analyse. Le
            document lui-même reste dans votre bibliothèque.
          </>
        }
        actionLabel="Retirer"
        pendingLabel="Retrait…"
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
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
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
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <tr className="border-b border-border last:border-0 hover:bg-accent/20">
      <td className="px-4 py-2.5 truncate max-w-xs sticky left-0 bg-card">
        {row.filename}
      </td>
      <td className="px-3 py-2.5 text-center">
        <StatusBadge status={row.status} error={row.error} />
      </td>
      {columns.map((c) => {
        const value = row.values?.[c.id];
        return (
          <td
            key={c.id}
            className="px-4 py-2.5 align-top max-w-xs text-xs leading-relaxed"
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
        <button
          type="button"
          disabled={pending}
          onClick={() => setDeleteOpen(true)}
          className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label="Retirer"
        >
          <IconTrash className="size-3.5" />
        </button>
        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Retirer ce document de l'analyse ?"
          description={
            <>
              « {row.filename} » sera retiré du tableau d&apos;analyse. Le
              document lui-même reste dans votre bibliothèque.
            </>
          }
          actionLabel="Retirer"
          pendingLabel="Retrait…"
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
  if (status === "pending") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
        title="En attente"
      >
        <IconClock className="size-3" />
        En attente
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-primary">
        <Spinner className="size-3" />
        En cours
      </span>
    );
  }
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-success">
        <IconCheck className="size-3" />
        OK
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] text-destructive"
      title={error ?? undefined}
    >
      <IconAlertTriangle className="size-3" />
      Erreur
    </span>
  );
}
