"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconCopy } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { clonePipeline } from "../actions";

interface CloneToEditButtonProps {
  pipelineId: string;
}

/**
 * CTA proéminent sur les pipelines preset (lecture seule par convention) :
 * en un clic, l'utilisateur obtient sa propre copie modifiable et y est
 * automatiquement redirigé. Élimine la friction « ouvrir le menu •••,
 * cliquer Cloner, retrouver la copie dans la liste ».
 */
export function CloneToEditButton({ pipelineId }: CloneToEditButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await clonePipeline(pipelineId);
      if (result.ok) {
        router.push(`/bureau/${result.id}`);
        toast.success("Pipeline clonée", {
          description: "Vous pouvez maintenant éditer chaque agent.",
        });
      } else {
        toast.error("Clonage impossible", { description: result.error });
      }
    });
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={pending}
      variant="default"
    >
      <IconCopy className="size-4" />
      {pending ? "Création de la copie…" : "Cloner pour éditer"}
    </Button>
  );
}
