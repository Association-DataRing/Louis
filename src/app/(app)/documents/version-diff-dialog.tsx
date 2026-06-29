"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { IconGitCompare } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { DisplayOp } from "@/lib/diff/line-diff";
import { getDocumentVersionDiff, type VersionDiffResult } from "./actions";

type Props = {
  currentId: string;
  currentVersion: number;
  olderId: string;
  olderVersion: number;
};

/**
 * H19 — bouton « Comparer » d'une version antérieure à la version courante.
 * Charge le diff à la demande (et le met en cache pour la durée du montage).
 */
export function VersionDiffButton({
  currentId,
  currentVersion,
  olderId,
  olderVersion,
}: Props) {
  const t = useTranslations("documents.versionDiff");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<VersionDiffResult | null>(null);

  function load() {
    setOpen(true);
    if (result) return;
    startTransition(async () => {
      setResult(await getDocumentVersionDiff(olderId, currentId));
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={load}
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        aria-label={t("compareAria", {
          older: olderVersion,
          current: currentVersion,
        })}
      >
        <IconGitCompare className="size-3" />
        {t("compare")}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <IconGitCompare className="size-5" />
              {t("dialogTitle", {
                older: olderVersion,
                current: currentVersion,
              })}
            </DialogTitle>
            <DialogDescription>{t("dialogDescription")}</DialogDescription>
          </DialogHeader>

          {pending && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              {t("computing")}
            </div>
          )}

          {!pending && result && !result.ok && (
            <p className="py-12 text-center text-sm text-destructive">
              {result.error}
            </p>
          )}

          {!pending && result && result.ok && (
            <DiffView
              ops={result.ops}
              truncated={result.truncated}
              olderVersion={olderVersion}
              newerVersion={currentVersion}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DiffView({
  ops,
  truncated,
  olderVersion,
  newerVersion,
}: {
  ops: DisplayOp[];
  truncated: boolean;
  olderVersion: number;
  newerVersion: number;
}) {
  const t = useTranslations("documents.versionDiff");
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.type === "add") added++;
    else if (op.type === "del") removed++;
  }

  if (added === 0 && removed === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t("noDifference", { older: olderVersion, newer: newerVersion })}
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 text-xs pb-2">
        <span className="inline-flex items-center gap-1 text-success">
          + {t("added", { count: added })}
        </span>
        <span className="inline-flex items-center gap-1 text-destructive">
          − {t("removed", { count: removed })}
        </span>
      </div>

      {truncated && (
        <p className="mb-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-foreground">
          {t("truncated")}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border font-mono text-xs">
        {ops.map((op, i) => {
          if (op.type === "gap") {
            return (
              <div
                key={i}
                className="bg-muted/40 px-3 py-1 text-center text-[10px] text-muted-foreground select-none"
              >
                ··· {t("linesUnchanged", { count: op.count })} ···
              </div>
            );
          }
          const cls =
            op.type === "add"
              ? "bg-success/10 text-foreground"
              : op.type === "del"
                ? "bg-destructive/10 text-foreground"
                : "text-muted-foreground";
          const marker =
            op.type === "add" ? "+" : op.type === "del" ? "−" : " ";
          return (
            <div key={i} className={`flex gap-2 px-3 py-0.5 ${cls}`}>
              <span
                aria-hidden
                className="w-3 shrink-0 select-none text-center opacity-70"
              >
                {marker}
              </span>
              <span className="whitespace-pre-wrap break-words">
                {op.text || " "}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
