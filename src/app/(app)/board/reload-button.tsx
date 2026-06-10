"use client";

import { useRouter } from "next/navigation";
import { IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

/**
 * Petit bouton de rechargement pour l'état vide du board. Les presets sont
 * semés à la volée par `listPipelines` ; si malgré tout rien n'apparaît
 * (course au premier rendu), un refresh suffit en général.
 */
export function ReloadButton() {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => router.refresh()}
      className="gap-1.5"
    >
      <IconRefresh className="size-3.5" />
      Recharger
    </Button>
  );
}
