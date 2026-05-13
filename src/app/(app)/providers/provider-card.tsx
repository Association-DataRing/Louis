"use client";

import { useState, useTransition } from "react";
import {
  IconCheck,
  IconAlertTriangle,
  IconCircleDashed,
  IconDots,
  IconExternalLink,
  IconKey,
  IconPlayerPlay,
  IconStar,
  IconTrash,
  IconLock,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  PROVIDER_CATALOG,
  SOVEREIGNTY_LABEL,
  type ProviderType,
} from "@/lib/providers/catalog";
import type { ProviderKey } from "@/db/schema/provider-keys";
import {
  createProviderKey,
  deleteProviderKey,
  setProviderKeyDefault,
  testProviderKey,
  toggleProviderKeyActive,
  updateProviderKey,
} from "./actions";

type Props = {
  type: ProviderType;
  keys: ProviderKey[];
};

export function ProviderCard({ type, keys }: Props) {
  // Le catalogue contient des composants React (icônes) → on ne peut pas le
  // passer en prop depuis un Server Component. Lookup côté client.
  const meta = PROVIDER_CATALOG[type];
  // Affiche la clé prioritaire : isDefault > la plus récente.
  const primary =
    keys.find((k) => k.isDefault) ?? keys[0] ?? null;
  const isConfigured = !!primary;
  const Icon = meta.icon;
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setDialogMode("create");
    setError(null);
    setDialogOpen(true);
  }

  function openEdit() {
    setDialogMode("edit");
    setError(null);
    setDialogOpen(true);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result =
        dialogMode === "create"
          ? await createProviderKey(null, formData)
          : await updateProviderKey(null, formData);
      if (result.ok) {
        setDialogOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  const sovereigntyVariant =
    meta.sovereignty === "fr"
      ? "default"
      : meta.sovereignty === "eu"
        ? "secondary"
        : "outline";

  return (
    <div className="border border-border rounded-lg p-5 bg-card flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 shrink-0 rounded-md bg-muted flex items-center justify-center">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-heading text-base tracking-tight truncate">
                {meta.label}
              </h3>
              <a
                href={meta.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Documentation"
              >
                <IconExternalLink className="size-3.5" />
              </a>
            </div>
            <Badge variant={sovereigntyVariant} className="mt-1 text-[10px]">
              {SOVEREIGNTY_LABEL[meta.sovereignty]}
            </Badge>
          </div>
        </div>

        {isConfigured && (
          <Switch
            checked={primary.isActive}
            disabled={pending}
            onCheckedChange={() => {
              startTransition(() => toggleProviderKeyActive(primary.id));
            }}
            aria-label="Activer ce provider"
          />
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        {meta.description}
      </p>

      {/* Status badges */}
      <div className="flex items-center gap-2 flex-wrap text-[10px]">
        {isConfigured ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5">
              <IconCheck className="size-2.5" />
              Configuré
            </span>
            {primary.isActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5">
                Activé
              </span>
            )}
            <TestBadge status={primary.lastTestStatus} />
            {keys.length > 1 && (
              <Badge variant="outline" className="text-[10px]">
                +{keys.length - 1} autre{keys.length > 2 ? "s" : ""}
              </Badge>
            )}
          </>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5">
            <IconCircleDashed className="size-2.5" />
            Non configuré
          </span>
        )}
      </div>

      {/* Body */}
      {isConfigured ? (
        <div className="rounded-md bg-muted/40 border border-border px-3 py-2.5 flex items-center gap-2">
          <IconLock className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs truncate flex-1 min-w-0">
            {primary.label}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            ••••••••
          </span>
        </div>
      ) : (
        <div className="rounded-md bg-muted/40 border border-dashed border-border px-3 py-4 flex flex-col items-center justify-center text-center gap-1">
          <IconKey className="size-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Aucune clé configurée
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isConfigured ? (
          <Button
            variant="outline"
            size="sm"
            onClick={openEdit}
            disabled={pending}
            className="flex-1"
          >
            <IconKey className="size-3.5" />
            Modifier la clé
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={openCreate}
            disabled={pending}
            className="flex-1"
          >
            <IconKey className="size-3.5" />
            Configurer
          </Button>
        )}
        {isConfigured && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="size-8 inline-flex items-center justify-center rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50"
              aria-label="Actions"
              disabled={pending}
            >
              <IconDots className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={pending || !meta.testBaseUrl}
                onSelect={() => {
                  startTransition(() => testProviderKey(primary.id));
                }}
              >
                <IconPlayerPlay className="size-4" />
                Tester la connexion
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={pending || primary.isDefault || keys.length === 1}
                onSelect={() => {
                  startTransition(() => setProviderKeyDefault(primary.id));
                }}
              >
                <IconStar className="size-4" />
                Définir par défaut
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={pending}
                onSelect={() => {
                  if (confirm(`Supprimer "${primary.label}" ?`)) {
                    startTransition(() => deleteProviderKey(primary.id));
                  }
                }}
              >
                <IconTrash className="size-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Dialog config / edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Icon className="size-5" />
              {dialogMode === "create" ? "Configurer" : "Modifier"} · {meta.label}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create" ? (
                <>
                  Votre clé est chiffrée avant d&apos;être stockée (AES-256-GCM).
                  Personne ne peut la voir, pas même l&apos;équipe Louis.
                </>
              ) : (
                <>
                  Vous pouvez changer le libellé ou remplacer la clé. Laisser
                  un champ vide pour le conserver tel quel.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <form action={handleSubmit} className="space-y-4">
            {dialogMode === "create" ? (
              <input type="hidden" name="type" value={meta.type} />
            ) : (
              <input type="hidden" name="id" value={primary?.id ?? ""} />
            )}

            <div className="space-y-2">
              <Label htmlFor={`label-${meta.type}`}>Libellé</Label>
              <Input
                id={`label-${meta.type}`}
                name="label"
                required={dialogMode === "create"}
                maxLength={80}
                defaultValue={dialogMode === "edit" ? primary?.label ?? "" : ""}
                placeholder={`ex. Compte cabinet ${meta.label}`}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`apiKey-${meta.type}`}>
                Clé API
                {dialogMode === "edit" && (
                  <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                    (laisser vide pour conserver)
                  </span>
                )}
              </Label>
              <Input
                id={`apiKey-${meta.type}`}
                name="apiKey"
                type="password"
                required={dialogMode === "create"}
                autoComplete="off"
                placeholder="sk-…"
              />
              <a
                href={meta.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2"
              >
                Obtenir une clé
                <IconExternalLink className="size-3" />
              </a>
            </div>

            {meta.requiresBaseUrl && (
              <div className="space-y-2">
                <Label htmlFor={`baseUrl-${meta.type}`}>URL de base</Label>
                <Input
                  id={`baseUrl-${meta.type}`}
                  name="baseUrl"
                  type="url"
                  required={dialogMode === "create"}
                  defaultValue={
                    dialogMode === "edit" ? primary?.baseUrl ?? "" : ""
                  }
                  placeholder={meta.baseUrlPlaceholder ?? "https://…"}
                />
                {meta.baseUrlHelp && (
                  <p className="text-xs text-muted-foreground">
                    {meta.baseUrlHelp}
                  </p>
                )}
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Enregistrement…"
                  : dialogMode === "create"
                    ? "Configurer"
                    : "Modifier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TestBadge({ status }: { status: string | null }) {
  if (!status) return null;
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5">
        <IconCheck className="size-2.5" />
        connecté
      </span>
    );
  }
  if (status === "skipped") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5">
      <IconAlertTriangle className="size-2.5" />
      {status === "auth_error" ? "auth invalide" : "erreur"}
    </span>
  );
}

