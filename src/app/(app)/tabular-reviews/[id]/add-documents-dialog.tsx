"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconPlus } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addReviewDocuments } from "../actions";

type DocOption = { id: string; filename: string };

/**
 * H15-c : ajoute des documents à une analyse existante (la promesse « vous
 * pourrez en ajouter plus tard »). N'affiche que les documents indexables
 * pas encore présents dans l'analyse.
 */
export function AddDocumentsDialog({
  reviewId,
  availableDocuments,
}: {
  reviewId: string;
  availableDocuments: DocOption[];
}) {
  const router = useRouter();
  const t = useTranslations("tabularReviews");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      const r = await addReviewDocuments(reviewId, ids);
      if (!r.ok) {
        toast.error(t("addDocuments.toastErrorTitle"), { description: r.error });
        return;
      }
      toast.success(t("addDocuments.toastSuccess", { count: ids.length }));
      setSelected(new Set());
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={availableDocuments.length === 0}
          title={
            availableDocuments.length === 0
              ? t("addDocuments.triggerTitleAllAdded")
              : undefined
          }
        >
          <IconPlus className="size-4" />
          {t("addDocuments.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addDocuments.dialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("addDocuments.dialogDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex max-h-[50vh] flex-col gap-1 overflow-y-auto px-1">
          {availableDocuments.map((d) => (
            <label
              key={d.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={selected.has(d.id)}
                onChange={() => toggle(d.id)}
                className="size-4 accent-primary"
              />
              <span className="truncate">{d.filename}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            {t("addDocuments.cancel")}
          </Button>
          <Button onClick={submit} disabled={pending || selected.size === 0}>
            {pending
              ? t("addDocuments.adding")
              : selected.size > 0
                ? t("addDocuments.addCount", { count: selected.size })
                : t("addDocuments.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
