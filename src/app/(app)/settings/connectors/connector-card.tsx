"use client";

import { useState, useTransition } from "react";
import {
  IconCheck,
  IconCircleDashed,
  IconDots,
  IconExternalLink,
  IconKey,
  IconLock,
  IconTrash,
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
  CATEGORY_LABEL,
  CONNECTOR_CATALOG,
  type ConnectorType,
} from "@/lib/connectors/catalog";
import type { ConnectorKey } from "@/db/schema/connector-keys";
import {
  createConnectorKey,
  deleteConnectorKey,
  toggleConnectorKeyActive,
  updateConnectorKey,
} from "./actions";

type Props = {
  type: ConnectorType;
  keys: ConnectorKey[];
};

export function ConnectorCard({ type, keys }: Props) {
  const meta = CONNECTOR_CATALOG[type];
  const Icon = meta.icon;
  const primary = keys[0] ?? null;
  const isConfigured = !!primary;
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
          ? await createConnectorKey(null, formData)
          : await updateConnectorKey(null, formData);
      if (result.ok) {
        setDialogOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  const categoryVariant =
    meta.category === "official" ? "default" : "secondary";

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
            <Badge variant={categoryVariant} className="mt-1 text-[10px]">
              {CATEGORY_LABEL[meta.category]}
            </Badge>
          </div>
        </div>

        {isConfigured && (
          <Switch
            checked={primary.isActive}
            disabled={pending}
            onCheckedChange={() => {
              startTransition(() => toggleConnectorKeyActive(primary.id));
            }}
            aria-label="Activer ce connecteur"
          />
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        {meta.description}
      </p>

      {/* Unlocks badges */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-muted-foreground mr-1">Débloque :</span>
        {meta.unlocks.map((u) => (
          <Badge key={u} variant="outline" className="text-[10px]">
            {u}
          </Badge>
        ))}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 flex-wrap text-[10px]">
        {isConfigured ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success px-2 py-0.5">
              <IconCheck className="size-2.5" />
              Configuré
            </span>
            {primary.isActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5">
                Activé
              </span>
            )}
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
          <span className="text-xs truncate flex-1 min-w-0">{primary.label}</span>
          <span className="text-[10px] text-muted-foreground font-mono">
            ••••••••
          </span>
        </div>
      ) : (
        <div className="rounded-md bg-muted/40 border border-dashed border-border px-3 py-4 flex flex-col items-center justify-center text-center gap-1">
          <IconKey className="size-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Aucun identifiant configuré
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
            Modifier
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
                variant="destructive"
                disabled={pending}
                onSelect={() => {
                  if (confirm(`Supprimer "${primary.label}" ?`)) {
                    startTransition(() => deleteConnectorKey(primary.id));
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
              {dialogMode === "create" ? "Configurer" : "Modifier"} ·{" "}
              {meta.label}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create" ? (
                <>
                  Vos identifiants sont chiffrés avant stockage (AES-256-GCM).
                  Aucun appel à cette API ne transite par un service tiers.
                </>
              ) : (
                <>
                  Modifier le libellé ou rotater les identifiants. Les champs
                  vides sont conservés à l&apos;identique.
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

            {meta.credentialFields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={`${field.name}-${meta.type}`}>
                  {field.label}
                  {dialogMode === "edit" && (
                    <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                      (laisser vide pour conserver)
                    </span>
                  )}
                </Label>
                <Input
                  id={`${field.name}-${meta.type}`}
                  name={field.name}
                  type={field.type}
                  required={dialogMode === "create" && field.required}
                  placeholder={field.placeholder}
                  autoComplete="off"
                />
                {field.help && (
                  <p className="text-xs text-muted-foreground">{field.help}</p>
                )}
              </div>
            ))}

            <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
              <span>Débloque :</span>
              {meta.unlocks.map((u) => (
                <Badge key={u} variant="outline" className="text-[10px]">
                  {u}
                </Badge>
              ))}
            </div>

            <a
              href={meta.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2"
            >
              S&apos;inscrire / obtenir les identifiants
              <IconExternalLink className="size-3" />
            </a>

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
