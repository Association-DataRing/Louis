"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { removeModel } from "./actions";

interface RemoveModelButtonProps {
  providerType: string;
  modelId: string;
  label: string;
}

/**
 * Bouton "retirer de ma plateforme" — utilisé dans la liste des modèles
 * activés. Confirmation via toast plutôt qu'AlertDialog parce que l'action
 * est facilement annulable (re-cocher dans la bibliothèque).
 */
export function RemoveModelButton({
  providerType,
  modelId,
  label,
}: RemoveModelButtonProps) {
  const router = useRouter();
  const t = useTranslations("settings.models");
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await removeModel({ providerType, modelId });
      if (result.ok) {
        router.refresh();
        toast.success(t("toast.removed.title"), {
          description: t("toast.removed.description", { label }),
        });
      } else {
        toast.error(t("toast.removeFailed"), { description: result.error });
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={handleClick}
      disabled={pending}
      aria-label={t("toggle.removeAria", { label })}
      className="text-muted-foreground hover:text-destructive"
    >
      <IconTrash className="size-3.5" />
    </Button>
  );
}
