"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  buttonLabel,
}: {
  buttonLabel?: string;
}) {
  const t = useTranslations("components");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 px-5 text-sm">
          <IconKey className="size-4" />
          {buttonLabel ?? t("providerQuickAdd.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl tracking-tight">
            {t("providerQuickAdd.title")}
          </DialogTitle>
          <DialogDescription>
            {t("providerQuickAdd.description")}
          </DialogDescription>
        </DialogHeader>
        <ProviderKeyForm
          idPrefix="quickadd"
          onSuccess={(label) => {
            setOpen(false);
            toast.success(t("providerQuickAdd.success", { label }));
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
