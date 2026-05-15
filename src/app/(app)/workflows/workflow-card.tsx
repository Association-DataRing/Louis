"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  IconDots,
  IconLibrary,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Workflow } from "@/db/schema";
import { deleteWorkflow, updateWorkflow } from "./actions";

export function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleEdit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateWorkflow(workflow.id, null, formData);
      if (result.ok) {
        setEditOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Supprimer le workflow "${workflow.name}" ?`)) return;
    startTransition(async () => {
      await deleteWorkflow(workflow.id);
      router.refresh();
    });
  }

  return (
    <>
      <div className="border border-border rounded-lg p-5 bg-card flex flex-col gap-3 group">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 shrink-0 rounded-md bg-muted flex items-center justify-center">
              <IconLibrary className="size-4 text-primary" />
            </div>
            <h3 className="font-heading text-base tracking-tight truncate">
              {workflow.name}
            </h3>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="size-8 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors disabled:opacity-50"
              aria-label="Actions"
              disabled={pending}
            >
              <IconDots className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <IconPencil className="size-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
                <IconTrash className="size-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {workflow.description && (
          <p className="text-xs text-muted-foreground">{workflow.description}</p>
        )}

        <div className="rounded-md bg-muted/40 border border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground line-clamp-4">
          {workflow.prompt}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              Modifier le workflow
            </DialogTitle>
            <DialogDescription>
              Les modifications sont disponibles immédiatement depuis le
              composer du chat.
            </DialogDescription>
          </DialogHeader>
          <form action={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`name-${workflow.id}`}>Nom</Label>
              <Input
                id={`name-${workflow.id}`}
                name="name"
                defaultValue={workflow.name}
                required
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`description-${workflow.id}`}>Description</Label>
              <Input
                id={`description-${workflow.id}`}
                name="description"
                defaultValue={workflow.description ?? ""}
                maxLength={300}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`prompt-${workflow.id}`}>Prompt</Label>
              <textarea
                id={`prompt-${workflow.id}`}
                name="prompt"
                defaultValue={workflow.prompt}
                required
                maxLength={4000}
                rows={6}
                className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
