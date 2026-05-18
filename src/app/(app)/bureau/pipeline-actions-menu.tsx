"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  IconCopy,
  IconDots,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Pipeline } from "@/db/schema";
import {
  clonePipeline,
  deletePipeline,
  updatePipelineMeta,
} from "./actions";

interface PipelineActionsMenuProps {
  pipeline: Pipeline;
}

export function PipelineActionsMenu({ pipeline }: PipelineActionsMenuProps) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(pipeline.name);
  const [description, setDescription] = useState(pipeline.description ?? "");

  function handleClone() {
    setError(null);
    startTransition(async () => {
      const result = await clonePipeline(pipeline.id);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  function handleDelete() {
    if (
      !confirm(
        `Supprimer la pipeline « ${pipeline.name} » ? Les conversations qui l'utilisaient continueront de fonctionner avec leur historique mais ne pourront plus l'invoquer.`
      )
    )
      return;
    startTransition(async () => {
      const result = await deletePipeline(pipeline.id);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  function handleRenameSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await updatePipelineMeta(pipeline.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      if (result.ok) {
        setRenameOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const isPreset = pipeline.isPreset;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="size-9 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors disabled:opacity-50"
          aria-label="Actions sur la pipeline"
          disabled={pending}
          onClick={(e) => {
            // Empêche la propagation au <Link> parent quand ce menu est
            // rendu à l'intérieur d'une carte cliquable (/bureau index).
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <IconDots className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleClone}>
            <IconCopy className="size-4" />
            Cloner
          </DropdownMenuItem>
          {!isPreset && (
            <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
              <IconPencil className="size-4" />
              Renommer
            </DropdownMenuItem>
          )}
          {!isPreset && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
                <IconTrash className="size-4" />
                Supprimer
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              Renommer la pipeline
            </DialogTitle>
            <DialogDescription>
              Changement de nom et de description visibles dans le sélecteur
              de pipeline du chat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`pname-${pipeline.id}`}>Nom</Label>
              <Input
                id={`pname-${pipeline.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pdesc-${pipeline.id}`}>Description</Label>
              <Input
                id={`pdesc-${pipeline.id}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRenameOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button onClick={handleRenameSubmit} disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
