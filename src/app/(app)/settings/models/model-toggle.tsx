"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleModel } from "./actions";

interface ModelToggleProps {
  providerType: string;
  modelId: string;
  enabled: boolean;
}

export function ModelToggle({
  providerType,
  modelId,
  enabled,
}: ModelToggleProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(next: boolean) {
    startTransition(async () => {
      const result = await toggleModel({
        providerType,
        modelId,
        enabled: next,
      });
      if (result.ok) {
        router.refresh();
        toast.success(
          next ? "Modèle activé" : "Modèle désactivé",
          { description: `${providerType} · ${modelId}` }
        );
      } else {
        toast.error("Mise à jour impossible", { description: result.error });
      }
    });
  }

  return (
    <Switch
      checked={enabled}
      onCheckedChange={handleChange}
      disabled={pending}
      aria-label={`${enabled ? "Désactiver" : "Activer"} le modèle ${modelId}`}
    />
  );
}
