"use client";

import { useActionState, useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  CONNECTOR_CATALOG,
  CONNECTOR_TYPES,
  type ConnectorType,
} from "@/lib/connectors/catalog";
import { createConnectorKey, type ActionResult } from "./actions";

const officialTypes = CONNECTOR_TYPES.filter(
  (t) => CONNECTOR_CATALOG[t].category === "official"
);
const commercialTypes = CONNECTOR_TYPES.filter(
  (t) => CONNECTOR_CATALOG[t].category === "commercial"
);

export function AddConnectorDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ConnectorType>("piste");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createConnectorKey,
    null
  );

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  const meta = CONNECTOR_CATALOG[type];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <IconPlus className="size-4" />
          Ajouter un connecteur
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">
            Ajouter un connecteur
          </DialogTitle>
          <DialogDescription>
            Vos identifiants sont chiffrés avant stockage (AES-256-GCM).
            Aucun appel à ces APIs ne transite par un service tiers.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Source</Label>
            <Select
              name="type"
              value={type}
              onValueChange={(v) => setType(v as ConnectorType)}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Officiels (api.gouv.fr)</SelectLabel>
                  {officialTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CONNECTOR_CATALOG[t].label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Commerciaux</SelectLabel>
                  {commercialTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CONNECTOR_CATALOG[t].label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[10px] text-muted-foreground">Débloque :</span>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Libellé</Label>
            <Input
              id="label"
              name="label"
              required
              maxLength={80}
              placeholder="ex. Compte cabinet PISTE"
            />
          </div>

          {meta.credentialFields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name}>{field.label}</Label>
              <Input
                id={field.name}
                name={field.name}
                type={field.type}
                required={field.required}
                placeholder={field.placeholder}
                autoComplete="off"
              />
              {field.help && (
                <p className="text-xs text-muted-foreground">{field.help}</p>
              )}
            </div>
          ))}

          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
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
