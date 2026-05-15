"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconFolderPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createFolder } from "./actions";

export function NewFolderButton({
  parentFolderId,
}: {
  parentFolderId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createFolder(name, parentFolderId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setName("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <IconFolderPlus className="size-4" />
          Nouveau dossier
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau dossier</DialogTitle>
          <DialogDescription>
            Les dossiers vous aident à organiser vos documents par client,
            dossier juridique ou matière. Vous pourrez y imbriquer
            d&apos;autres dossiers.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="folder-name">Nom</Label>
          <Input
            id="folder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dossier Dupont SAS"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) submit();
            }}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button
            onClick={submit}
            disabled={pending || !name.trim()}
          >
            {pending ? "Création…" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
