"use client";

import { useState, useTransition } from "react";
import { IconPlus, IconExternalLink } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  PROVIDER_CATALOG,
  PROVIDER_TYPES,
  SOVEREIGNTY_LABEL,
  type ProviderType,
} from "@/lib/providers/catalog";
import { createProviderKey } from "./actions";

const sovereignTypes = PROVIDER_TYPES.filter(
  (t) => PROVIDER_CATALOG[t].sovereignty !== "us"
);
const usTypes = PROVIDER_TYPES.filter(
  (t) => PROVIDER_CATALOG[t].sovereignty === "us"
);

export function AddProviderDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ProviderType>("mistral");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createProviderKey(null, formData);
      if (result.ok) {
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  const meta = PROVIDER_CATALOG[type];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <IconPlus className="size-4" />
          Ajouter un provider
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Ajouter une clé API</DialogTitle>
          <DialogDescription>
            Votre clé est chiffrée avant d&apos;être stockée. Personne — ni
            l&apos;équipe Louis, ni vos co-utilisateurs — ne peut la voir.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Fournisseur</Label>
            <Select
              name="type"
              value={type}
              onValueChange={(v) => setType(v as ProviderType)}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Souverains (FR/UE)</SelectLabel>
                  {sovereignTypes.map((t) => {
                    const m = PROVIDER_CATALOG[t];
                    return (
                      <SelectItem key={t} value={t}>
                        {m.label}{" "}
                        <span className="ml-1 text-xs text-muted-foreground">
                          · {SOVEREIGNTY_LABEL[m.sovereignty]}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>États-Unis</SelectLabel>
                  {usTypes.map((t) => {
                    const m = PROVIDER_CATALOG[t];
                    return (
                      <SelectItem key={t} value={t}>
                        {m.label}{" "}
                        <span className="ml-1 text-xs text-muted-foreground">
                          · {SOVEREIGNTY_LABEL[m.sovereignty]}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
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

          <div className="space-y-2">
            <Label htmlFor="label">Libellé</Label>
            <Input
              id="label"
              name="label"
              required
              maxLength={80}
              placeholder="ex. Compte cabinet Mistral"
            />
            <p className="text-xs text-muted-foreground">
              Un nom court pour vous repérer si vous avez plusieurs clés.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">Clé API</Label>
            <Input
              id="apiKey"
              name="apiKey"
              type="password"
              required
              autoComplete="off"
              placeholder="sk-…"
            />
          </div>

          {meta.requiresBaseUrl && (
            <div className="space-y-2">
              <Label htmlFor="baseUrl">URL de base</Label>
              <Input
                id="baseUrl"
                name="baseUrl"
                type="url"
                required
                placeholder={meta.baseUrlPlaceholder ?? "https://…"}
              />
              {meta.baseUrlHelp && (
                <p className="text-xs text-muted-foreground">{meta.baseUrlHelp}</p>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Ajout…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
