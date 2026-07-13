"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("board");
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await clonePipeline(pipelineId);
      if (result.ok) {
        router.push(`/board/${result.id}`);
        toast.success(t("cloneToEdit.cloned"), {
          description: t("cloneToEdit.clonedDesc"),
        });
      } else {
        toast.error(t("cloneToEdit.cloneError"), { description: result.error });
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
      {pending ? t("cloneToEdit.creating") : t("cloneToEdit.label")}
    </Button>
  );
}
