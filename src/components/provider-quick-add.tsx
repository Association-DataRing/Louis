"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconKey } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProviderKeyForm } from "@/components/provider-key-form";

/**
 * Quick-add provider — connecte une première clé IA sans quitter la page.
 * Utilisé par les états vides (chat, bibliothèque de modèles) pour supprimer
 * le détour par /settings/providers au premier lancement.
 */
export function ProviderQuickAdd({
  buttonLabel = "Connecter une clé IA",
}: {
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 px-5 text-sm">
          <IconKey className="size-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl tracking-tight">
            Connectez votre intelligence.
          </DialogTitle>
          <DialogDescription>
            Choisissez un provider, collez votre clé : Louis la teste avant de
            l&apos;enregistrer, puis active les modèles correspondants.
          </DialogDescription>
        </DialogHeader>
        <ProviderKeyForm
          idPrefix="quickadd"
          onSuccess={(label) => {
            setOpen(false);
            toast.success(`Clé ${label} connectée — vos modèles sont prêts.`);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
