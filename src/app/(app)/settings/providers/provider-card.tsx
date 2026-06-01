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
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
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
  PROVIDER_CATALOG,
  SOVEREIGNTY_LABEL,
  type ProviderType,
} from "@/lib/providers/catalog";
import type { ProviderKey } from "@/db/schema/provider-keys";
import { cn } from "@/lib/utils";
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
  const meta = PROVIDER_CATALOG[type];
  const primary = keys.find((k) => k.isDefault) ?? keys[0] ?? null;
  const isConfigured = !!primary;
  const Icon = meta.icon;
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
          ? await createProviderKey(null, formData)
          : await updateProviderKey(null, formData);
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
      >
        <CutoutCardMedia
          className="relative h-44 w-full"
          style={{ background: meta.accent }}
        >
          {/* Brand logo via CSS mask so monochrome SVGs pick up the tint */}
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

          {/* Sovereignty pin — top-left */}
          <CutoutCardPin className="left-3 top-3 flex items-center gap-1 rounded-full bg-card/85 px-2 py-1 backdrop-blur-sm">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-card-foreground">
              {SOVEREIGNTY_LABEL[meta.sovereignty]}
            </span>
          </CutoutCardPin>

          {/* Switch pin — top-right floating pill, only when configured */}
          {isConfigured && (
            <CutoutCardPin
              className="right-3 top-3 flex items-center gap-2 rounded-full bg-card/85 px-2.5 py-1 backdrop-blur-sm"
            >
              <span className="text-[10px] font-medium text-card-foreground/80">
                {primary.isActive ? "Activé" : "Inactif"}
              </span>
              <Switch
                checked={primary.isActive}
                disabled={pending}
                onCheckedChange={() => {
                  startTransition(() => toggleProviderKeyActive(primary.id));
                }}
                aria-label="Activer ce provider"
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
                <TestBadge status={primary.lastTestStatus} />
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
                >
                  <IconDots className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    // R5 : testable dès qu'une base existe — soit l'URL du
                    // catalogue, soit le baseUrl saisi par l'utilisateur
                    // (Scaleway/OVH/Albert/OpenAI-compatible self-host). Avant,
                    // ces providers avaient un test grisé sans explication.
                    disabled={pending || !(meta.testBaseUrl || primary.baseUrl)}
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
                    onSelect={() => setDeleteOpen(true)}
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

          {isConfigured && (
            <p className="text-[11px] text-muted-foreground/80 truncate">
              <span className="font-mono">••••</span>{" "}
              <span className="font-medium text-foreground/80">
                {primary.label}
              </span>
            </p>
          )}

          <div className="mt-auto pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={openDialog}
              aria-label={`${isConfigured ? "Modifier" : "Configurer"} ${meta.label}`}
            >
              <IconKey className="size-3.5" />
              {isConfigured ? "Modifier" : "Configurer"}
            </Button>
          </div>
        </CutoutCardContent>

        {/* Reveal-on-hover CTA */}
        <CutoutCardAction className="right-5 bottom-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary-foreground shadow-sm">
            <IconKey className="size-3" />
            {isConfigured ? "Modifier" : "Configurer"}
          </span>
        </CutoutCardAction>
      </CutoutCard>

      {/* Dialog config / edit — rendered outside CutoutCard so card click doesn't bubble */}
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

      {primary && (
        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Supprimer cette clé ?"
          description={
            <>
              « {primary.label} » sera supprimée. La clé chiffrée est retirée
              de votre instance — les conversations utilisant ce provider
              échoueront tant qu&apos;une nouvelle clé n&apos;est pas saisie.
            </>
          }
          pending={pending}
          onConfirm={() => {
            startTransition(async () => {
              await deleteProviderKey(primary.id);
              setDeleteOpen(false);
            });
          }}
        />
      )}
    </>
  );
}

function TestBadge({ status }: { status: string | null }) {
  if (!status || status === "skipped") return null;
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success px-2 py-0.5 text-[10px]">
        connecté
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px]">
      <IconAlertTriangle className="size-2.5" />
      {status === "auth_error" ? "auth invalide" : "erreur"}
    </span>
  );
}
