"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconPlus, IconEdit } from "@tabler/icons-react";
import { toast } from "sonner";
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
import { createSkill, updateSkill } from "./actions";

type Mode =
  | { kind: "create" }
  | {
      kind: "edit";
      skillId: string;
      initial: {
        name: string;
        description: string;
        triggerHint: string;
        systemPrompt: string;
      };
    };

interface Props {
  mode: Mode;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SkillFormDialog({
  mode,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : mode.kind === "create" ? (
        <DialogTrigger asChild>
          <Button>
            <IconPlus className="size-4" />
            Nouvelle compétence
          </Button>
        </DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <IconEdit className="size-4" />
            Éditer
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Le form n'est rendu QUE quand le dialog est ouvert : ses
            useState s'initialisent avec les bonnes valeurs sans avoir
            besoin d'un useEffect de sync. Quand le dialog se ferme et
            se rouvre, on a un re-mount frais. */}
        {open && <SkillForm mode={mode} onClose={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function SkillForm({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const router = useRouter();
  const initial = mode.kind === "edit" ? mode.initial : null;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [triggerHint, setTriggerHint] = useState(initial?.triggerHint ?? "");
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = { name, description, triggerHint, systemPrompt };
      const result =
        mode.kind === "create"
          ? await createSkill(payload)
          : await updateSkill(mode.skillId, payload);
      if (result.ok) {
        onClose();
        router.refresh();
        toast.success(
          mode.kind === "create" ? "Compétence créée" : "Compétence mise à jour",
          { description: name }
        );
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading">
          {mode.kind === "create" ? "Nouvelle compétence" : "Éditer la compétence"}
        </DialogTitle>
        <DialogDescription>
          Une compétence est une mini-instruction que Louis injecte
          automatiquement dans le prompt système quand le détecteur identifie
          qu&apos;elle est pertinente à votre demande.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="skill-name">Nom</Label>
          <Input
            id="skill-name"
            required
            maxLength={120}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. Vérification de citations"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="skill-desc">Description courte</Label>
          <Input
            id="skill-desc"
            required
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="À quoi sert cette compétence ?"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="skill-hint">
            Quand l&apos;activer{" "}
            <span className="text-[10px] text-muted-foreground font-normal">
              (sert au détecteur)
            </span>
          </Label>
          <Input
            id="skill-hint"
            required
            maxLength={500}
            value={triggerHint}
            onChange={(e) => setTriggerHint(e.target.value)}
            placeholder="ex. Quand l'utilisateur cite une jurisprudence ou un article de loi"
          />
          <p className="text-[11px] text-muted-foreground">
            Phrase descriptive lue par un petit modèle qui décide d&apos;activer
            ou non la compétence selon la demande.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="skill-prompt">Instruction système</Label>
          <textarea
            id="skill-prompt"
            required
            maxLength={8000}
            rows={8}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Le texte qui sera injecté dans le prompt système quand la compétence est activée…"
            className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm font-mono leading-relaxed shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <p className="text-[11px] text-muted-foreground">
            Soyez explicite, donnez des exemples si nécessaire. Cette
            instruction prend le pas sur le comportement par défaut.
          </p>
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
            onClick={onClose}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={pending}>
            {pending
              ? mode.kind === "create"
                ? "Création…"
                : "Enregistrement…"
              : mode.kind === "create"
              ? "Créer"
              : "Enregistrer"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
