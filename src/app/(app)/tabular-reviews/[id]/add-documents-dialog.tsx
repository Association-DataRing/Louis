"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
        toast.error("Ajout impossible", { description: r.error });
        return;
      }
      toast.success(`${ids.length} document${ids.length > 1 ? "s" : ""} ajouté${ids.length > 1 ? "s" : ""}.`);
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
              ? "Tous vos documents indexés sont déjà dans l'analyse"
              : undefined
          }
        >
          <IconPlus className="size-4" />
          Ajouter des documents
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter des documents</DialogTitle>
          <DialogDescription>
            Les documents ajoutés apparaîtront « en attente » ; lancez ensuite
            l&apos;extraction.
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
            Annuler
          </Button>
          <Button onClick={submit} disabled={pending || selected.size === 0}>
            {pending
              ? "Ajout…"
              : `Ajouter${selected.size > 0 ? ` (${selected.size})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
