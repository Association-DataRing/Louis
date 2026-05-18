"use client";

import { useState, useTransition, type MouseEvent } from "react";
import {
  IconCheck,
  IconCircleDashed,
  IconDots,
  IconExternalLink,
  IconKey,
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
  CutoutCard,
  CutoutCardAction,
  CutoutCardContent,
  CutoutCardInsetLabel,
  CutoutCardMedia,
  CutoutCardOverlay,
  CutoutCardPin,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "@/components/ui/cutout-card";
import {
  CATEGORY_LABEL,
  CONNECTOR_CATALOG,
  type ConnectorType,
} from "@/lib/connectors/catalog";
import type { ConnectorKey } from "@/db/schema/connector-keys";
import { cn } from "@/lib/utils";
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

function stopCardClick(e: MouseEvent) {
  e.stopPropagation();
}

export function ConnectorCard({ type, keys }: Props) {
  const meta = CONNECTOR_CATALOG[type];
  const Icon = meta.icon;
  const primary = keys[0] ?? null;
  const isConfigured = !!primary;
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [error, setError] = useState<string | null>(null);

  function openDialog() {
    setDialogMode(isConfigured ? "edit" : "create");
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

  return (
    <>
      <CutoutCard
        className={cn(cutoutCardSurfaceClassName, "flex flex-col")}
        role="button"
        tabIndex={0}
        aria-label={`${isConfigured ? "Modifier" : "Configurer"} ${meta.label}`}
        onClick={openDialog}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDialog();
          }
        }}
      >
        <CutoutCardMedia
          className="relative h-44 w-full"
          style={{ background: meta.accent }}
        >
          <div
            aria-hidden
            className="absolute inset-0 m-auto h-20 w-20 transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/cutout:scale-110"
            style={{
              WebkitMaskImage: `url(${meta.logo})`,
              maskImage: `url(${meta.logo})`,
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              WebkitMaskSize: "contain",
              maskSize: "contain",
              backgroundColor: meta.logoTint,
            }}
          />
          <CutoutCardOverlay />

          {/* Category pin — top-left */}
          <CutoutCardPin className="left-3 top-3 flex items-center gap-1 rounded-full bg-card/85 px-2 py-1 backdrop-blur-sm">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-card-foreground">
              {CATEGORY_LABEL[meta.category]}
            </span>
          </CutoutCardPin>

          {/* Switch pin — top-right floating pill */}
          {isConfigured && (
            <CutoutCardPin
              className="right-3 top-3 flex items-center gap-2 rounded-full bg-card/85 px-2.5 py-1 backdrop-blur-sm"
              onClick={stopCardClick}
            >
              <span className="text-[10px] font-medium text-card-foreground/80">
                {primary.isActive ? "Activé" : "Inactif"}
              </span>
              <Switch
                checked={primary.isActive}
                disabled={pending}
                onCheckedChange={() => {
                  startTransition(() => toggleConnectorKeyActive(primary.id));
                }}
                aria-label="Activer ce connecteur"
              />
            </CutoutCardPin>
          )}

          {/* Status inset label — bottom-left */}
          <CutoutCardInsetLabel className="bottom-0 left-0 flex items-center gap-2 rounded-tr-[20px] bg-card px-4 py-2.5">
            {isConfigured ? (
              <>
                <IconCheck className="size-3.5 text-success" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-card-foreground">
                  Configuré
                </span>
                {keys.length > 1 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{keys.length - 1}
                  </Badge>
                )}
              </>
            ) : (
              <>
                <IconCircleDashed className="size-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Non configuré
                </span>
              </>
            )}
            <CutoutCorner className="absolute -right-[31px] -bottom-px rotate-90 text-card" />
            <CutoutCorner className="absolute -top-[31px] -left-px rotate-90 text-card" />
          </CutoutCardInsetLabel>
        </CutoutCardMedia>

        <CutoutCardContent className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex items-center gap-2">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <h3 className="font-heading text-base tracking-tight truncate">
                {meta.label}
              </h3>
              <a
                href={meta.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={stopCardClick}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Documentation"
              >
                <IconExternalLink className="size-3.5" />
              </a>
            </div>
            {isConfigured && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="-mt-1 -mr-1 size-7 inline-flex shrink-0 items-center justify-center rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50"
                  aria-label="Actions"
                  disabled={pending}
                  onClick={stopCardClick}
                >
                  <IconDots className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onClick={stopCardClick}
                >
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

          <p className="text-xs text-muted-foreground leading-relaxed">
            {meta.description}
          </p>

          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground mr-1">
              Débloque :
            </span>
            {meta.unlocks.map((u) => (
              <Badge key={u} variant="outline" className="text-[10px]">
                {u}
              </Badge>
            ))}
          </div>

          {isConfigured && (
            <p className="text-[11px] text-muted-foreground/80 truncate">
              <span className="font-mono">••••</span>{" "}
              <span className="font-medium text-foreground/80">
                {primary.label}
              </span>
            </p>
          )}
        </CutoutCardContent>

        <CutoutCardAction className="right-5 bottom-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary-foreground shadow-sm">
            <IconKey className="size-3" />
            {isConfigured ? "Modifier" : "Configurer"}
          </span>
        </CutoutCardAction>
      </CutoutCard>

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
    </>
  );
}
