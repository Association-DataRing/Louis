"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Dialogue de confirmation destructive — remplace les `window.confirm()`
 * natifs sur des opérations data-loss (suppression de conversation,
 * document, projet…). Controlled : le caller pilote `open` et déclenche
 * lui-même `onConfirm` (typiquement dans un useTransition).
 *
 * On ne ferme pas automatiquement après le clic — c'est au caller de
 * fermer après que la server action a réussi (évite de fermer le dialog
 * si l'action échoue et qu'on veut afficher l'erreur). Pour les call sites
 * existants qui n'attendent pas de retour, fermer dans `onConfirm` avant
 * `startTransition` est OK aussi.
 */
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  actionLabel?: string;
  pendingLabel?: string;
  pending?: boolean;
  /**
   * `destructive` (défaut) — bouton rouge, pour suppressions data-loss.
   * `default` — bouton primaire, pour confirmations d'action potentiellement
   * coûteuse mais non destructive (re-runs, exports, etc.).
   */
  variant?: "destructive" | "default";
  onConfirm: () => void;
};

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  pendingLabel,
  pending = false,
  variant = "destructive",
  onConfirm,
}: Props) {
  const t = useTranslations("components");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("confirmDelete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={pending}
            className={
              variant === "destructive"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }
          >
            {pending
              ? pendingLabel ?? t("confirmDelete.pending")
              : actionLabel ?? t("confirmDelete.action")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
