"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createWorkflow } from "./actions";

export function AddWorkflowDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createWorkflow(null, formData);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <IconPlus className="size-4" />
          Nouveau workflow
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Nouveau workflow</DialogTitle>
          <DialogDescription>
            Donnez un nom à votre template et écrivez le prompt que vous
            voudrez réutiliser dans le chat.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={120}
              autoFocus
              placeholder="ex. Résumé d'arrêt en 5 points"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">
              Description{" "}
              <span className="text-[10px] text-muted-foreground font-normal">
                (optionnel)
              </span>
            </Label>
            <Input
              id="description"
              name="description"
              maxLength={300}
              placeholder="Note rapide sur l'usage du template"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <textarea
              id="prompt"
              name="prompt"
              required
              maxLength={4000}
              rows={6}
              placeholder="Le texte qui sera inséré dans le composer du chat…"
              className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
