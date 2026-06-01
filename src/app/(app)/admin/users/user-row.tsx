"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  IconDots,
  IconKey,
  IconCoin,
  IconUserCheck,
  IconUserOff,
  IconShield,
  IconShieldOff,
  IconTrash,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import {
  deleteUser,
  resetUserPassword,
  setUserRole,
  toggleUserActive,
  updateUserQuota,
} from "./actions";
import type { UserRole } from "@/db/schema/users";

type Entry = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  monthlyQuotaCents: number | null;
};

export type UserStats = {
  convCount: number;
  docCount: number;
  projectCount: number;
  monthCost: Record<"EUR" | "USD", number>;
  lastActivity: Date | null;
};

export type UserEntryWithStats = Entry & { stats: UserStats };

function formatRelativeFr(d: Date | string | null): string {
  if (!d) return "jamais utilisé";
  const date = typeof d === "string" ? new Date(d) : d;
  const ms = Date.now() - date.getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `il y a ${days} j`;
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`;
  return date.toLocaleDateString("fr-FR");
}

function formatEurFromCents(cents: number | null): string {
  if (cents == null) return "—";
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <div className="text-[9px] uppercase tracking-wider opacity-70">
        {label}
      </div>
      <div className="mt-0.5 font-medium text-foreground">{value}</div>
    </div>
  );
}

export function UserRow({
  entry,
  currentUserId,
}: {
  entry: UserEntryWithStats;
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [quotaDraftEuros, setQuotaDraftEuros] = useState(
    entry.monthlyQuotaCents != null
      ? (entry.monthlyQuotaCents / 100).toString()
      : ""
  );
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const isSelf = entry.id === currentUserId;

  // Cumul ce mois en € pour ce user (somme des coûts EUR+USD convertis
  // approximativement — pas de change rate ici, on affiche les EUR si
  // dispo sinon les USD).
  const monthSpentCents = Math.round(
    (entry.stats.monthCost.EUR + entry.stats.monthCost.USD) * 100
  );
  const quotaCents = entry.monthlyQuotaCents;
  const quotaPercent =
    quotaCents != null && quotaCents > 0
      ? Math.min(100, Math.round((monthSpentCents / quotaCents) * 100))
      : null;

  function handleSaveQuota() {
    setQuotaError(null);
    const trimmed = quotaDraftEuros.trim();
    // Reset = champ vide → null
    if (trimmed === "") {
      startTransition(async () => {
        const result = await updateUserQuota(entry.id, null);
        if (!result.ok) {
          setQuotaError(result.error);
          return;
        }
        setQuotaOpen(false);
      });
      return;
    }
    const parsed = Number(trimmed.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setQuotaError("Saisissez un montant positif en euros.");
      return;
    }
    const cents = Math.round(parsed * 100);
    startTransition(async () => {
      const result = await updateUserQuota(entry.id, cents);
      if (!result.ok) {
        setQuotaError(result.error);
        return;
      }
      setQuotaOpen(false);
    });
  }

  function handleResetPassword(formData: FormData) {
    setResetError(null);
    const next = (formData.get("password") as string)?.trim() ?? "";
    if (next.length < 10) {
      setResetError("Trop court — 10 caractères minimum.");
      return;
    }
    startTransition(async () => {
      const result = await resetUserPassword(entry.id, next);
      if (result.ok) {
        setResetOpen(false);
        setFeedback(`Mot de passe réinitialisé pour ${entry.email}`);
        window.setTimeout(() => setFeedback(null), 4000);
      } else {
        setResetError(result.error);
      }
    });
  }

  return (
    <div className="px-5 py-4 flex items-center gap-4">
      <div className="shrink-0 size-9 rounded-full bg-muted flex items-center justify-center text-foreground font-medium text-sm">
        {entry.name.slice(0, 1).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/admin/users/${entry.id}`}
            className="font-medium truncate hover:underline underline-offset-2"
          >
            {entry.name}
          </Link>
          {entry.role === "admin" && (
            <Badge variant="default" className="text-[10px] gap-1">
              <IconShield className="size-2.5" />
              Admin
            </Badge>
          )}
          {!entry.isActive && (
            <Badge variant="outline" className="text-[10px]">
              désactivé
            </Badge>
          )}
          {isSelf && (
            <Badge variant="secondary" className="text-[10px]">
              vous
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {entry.email}
          {" · "}
          {entry.stats.lastActivity
            ? `actif ${formatRelativeFr(entry.stats.lastActivity)}`
            : entry.lastLogin
              ? `connecté ${formatRelativeFr(entry.lastLogin)}`
              : "jamais utilisé"}
        </div>
        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className="text-xs text-success mt-1"
          >
            {feedback}
          </div>
        )}

        {/* Résumé compact des stats sur mobile : la rangée détaillée
            (Conv./Docs/Projets/Ce mois) est masquée < md, on reflow donc
            les chiffres ici pour ne pas les perdre sur petit écran. */}
        <div className="md:hidden mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-muted-foreground">
          <span>
            <span className="opacity-70">Conv. </span>
            <span className="font-medium text-foreground">
              {entry.stats.convCount}
            </span>
          </span>
          <span>
            <span className="opacity-70">Docs </span>
            <span className="font-medium text-foreground">
              {entry.stats.docCount}
            </span>
          </span>
          <span>
            <span className="opacity-70">Projets </span>
            <span className="font-medium text-foreground">
              {entry.stats.projectCount}
            </span>
          </span>
          <span>
            <span className="opacity-70">Ce mois </span>
            <span
              className={`font-medium ${
                quotaCents != null &&
                quotaCents > 0 &&
                monthSpentCents >= quotaCents
                  ? "text-destructive"
                  : "text-foreground"
              }`}
            >
              {formatEurFromCents(monthSpentCents)}
              {quotaCents != null && (
                <span className="font-normal opacity-70">
                  {" / "}
                  {formatEurFromCents(quotaCents)}
                </span>
              )}
            </span>
          </span>
        </div>
      </div>

      {/* Stats compactes : 4 chiffres en tabular-nums. Cabinet-friendly :
          on voit d'un coup d'œil le volume et le coût. */}
      <div className="hidden md:flex shrink-0 items-center gap-5 text-xs tabular-nums text-muted-foreground">
        <StatCell label="Conv." value={entry.stats.convCount} />
        <StatCell label="Docs" value={entry.stats.docCount} />
        <StatCell label="Projets" value={entry.stats.projectCount} />
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider opacity-70">
            Ce mois
          </div>
          <div
            className={`mt-0.5 font-medium ${
              quotaCents != null &&
              quotaCents > 0 &&
              monthSpentCents >= quotaCents
                ? "text-destructive"
                : "text-foreground"
            }`}
          >
            {formatEurFromCents(monthSpentCents)}
            {quotaCents != null && (
              <span className="text-muted-foreground font-normal">
                {" / "}
                {formatEurFromCents(quotaCents)}
              </span>
            )}
          </div>
          {quotaPercent != null && (
            <div
              className="mt-1 h-1 w-20 rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-label="Consommation du quota"
              aria-valuenow={monthSpentCents}
              aria-valuemin={0}
              aria-valuemax={quotaCents ?? undefined}
            >
              <div
                className={`h-full transition-all ${
                  quotaPercent >= 100
                    ? "bg-destructive"
                    : quotaPercent >= 80
                      ? "bg-warning"
                      : "bg-foreground/60"
                }`}
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Aucune action n'est applicable sur son propre compte (anti-lockout
          côté server) — autant retirer complètement le trigger plutôt que
          le laisser disabled, ce qui laisse penser que ça doit faire
          quelque chose. */}
      {!isSelf && (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="size-8 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors disabled:opacity-50"
          aria-label="Actions"
          disabled={pending}
        >
          <IconDots className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setResetError(null);
              setResetOpen(true);
            }}
          >
            <IconKey className="size-4" />
            Réinitialiser le mot de passe
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setQuotaError(null);
              setQuotaDraftEuros(
                entry.monthlyQuotaCents != null
                  ? (entry.monthlyQuotaCents / 100).toString()
                  : ""
              );
              setQuotaOpen(true);
            }}
          >
            <IconCoin className="size-4" />
            Quota mensuel
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              startTransition(async () => {
                const nextRole =
                  entry.role === "admin" ? "member" : "admin";
                const result = await setUserRole(entry.id, nextRole);
                if (!result.ok) {
                  setFeedback(result.error);
                  window.setTimeout(() => setFeedback(null), 4000);
                }
              });
            }}
          >
            {entry.role === "admin" ? (
              <>
                <IconShieldOff className="size-4" />
                Rétrograder en membre
              </>
            ) : (
              <>
                <IconShield className="size-4" />
                Promouvoir administrateur
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              startTransition(() => toggleUserActive(entry.id));
            }}
          >
            {entry.isActive ? (
              <>
                <IconUserOff className="size-4" />
                Désactiver
              </>
            ) : (
              <>
                <IconUserCheck className="size-4" />
                Activer
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <IconTrash className="size-4" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      )}

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer cet utilisateur ?"
        description={
          <>
            « {entry.email} » sera supprimé. Toutes ses données — clés
            providers, connecteurs, conversations, documents, workflows — seront
            définitivement perdues.
          </>
        }
        pending={pending}
        onConfirm={() => {
          startTransition(async () => {
            await deleteUser(entry.id);
            setDeleteOpen(false);
          });
        }}
      />

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              Réinitialiser le mot de passe
            </DialogTitle>
            <DialogDescription>
              Nouveau mot de passe pour <strong>{entry.email}</strong>.
              L&apos;utilisateur devra l&apos;utiliser à sa prochaine connexion
              — communiquez-le-lui par un canal sûr.
            </DialogDescription>
          </DialogHeader>
          <form action={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`reset-pwd-${entry.id}`}>Mot de passe</Label>
              <Input
                id={`reset-pwd-${entry.id}`}
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                placeholder="10 caractères minimum"
                autoFocus
              />
            </div>
            {resetError && (
              <Alert variant="destructive">
                <AlertDescription>{resetError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setResetOpen(false)}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Réinitialisation…" : "Réinitialiser"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={quotaOpen} onOpenChange={setQuotaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Quota mensuel</DialogTitle>
            <DialogDescription>
              Plafond de dépense IA en euros pour <strong>{entry.email}</strong>{" "}
              chaque mois calendaire. Au-delà, les nouvelles requêtes sont
              refusées par Louis jusqu&apos;au mois suivant. Laissez vide
              pour aucune limite.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`quota-${entry.id}`}>Montant en euros</Label>
              <div className="relative">
                <Input
                  id={`quota-${entry.id}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={quotaDraftEuros}
                  onChange={(e) => setQuotaDraftEuros(e.target.value)}
                  placeholder="Aucune limite"
                  autoFocus
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  €
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Consommé ce mois :{" "}
                <span className="tabular-nums font-medium text-foreground">
                  {formatEurFromCents(monthSpentCents)}
                </span>
              </p>
            </div>
            {quotaError && (
              <Alert variant="destructive">
                <AlertDescription>{quotaError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
            {entry.monthlyQuotaCents != null && (
              <button
                type="button"
                onClick={() => {
                  setQuotaDraftEuros("");
                }}
                disabled={pending}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Retirer la limite
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setQuotaOpen(false)}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleSaveQuota}
                disabled={pending}
              >
                {pending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
