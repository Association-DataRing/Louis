"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconAlertTriangle, IconBrush } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { pruneOrphanModels } from "./actions";

interface OrphansBannerProps {
  count: number;
}

/**
 * Bandeau d'alerte affiché quand certains modèles activés ne pointent
 * plus sur un provider actif (clé désactivée, supprimée, jamais
 * configurée à cause d'un seed legacy). Le bouton de nettoyage retire
 * ces orphelins en un clic.
 */
export function OrphansBanner({ count }: OrphansBannerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClean() {
    startTransition(async () => {
      const result = await pruneOrphanModels();
      if (result.ok) {
        router.refresh();
        toast.success(
          `${count} modèle${count > 1 ? "s" : ""} orphelin${count > 1 ? "s" : ""} retiré${count > 1 ? "s" : ""}`
        );
      } else {
        toast.error("Nettoyage impossible", { description: result.error });
      }
    });
  }

  return (
    <div className="mb-6 rounded-lg border border-foreground/15 bg-muted/20 p-3 flex items-start gap-3">
      <IconAlertTriangle className="size-4 text-foreground/60 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {count} modèle{count > 1 ? "s" : ""} sans provider actif
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Ils restent dans votre bibliothèque mais ne sont pas utilisables
          tant que vous n&apos;avez pas de clé configurée pour leur
          provider d&apos;origine.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClean}
        disabled={pending}
      >
        <IconBrush className="size-3.5" />
        {pending ? "Nettoyage…" : "Nettoyer"}
      </Button>
    </div>
  );
}
