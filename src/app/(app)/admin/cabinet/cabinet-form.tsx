"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { CabinetSettings } from "@/db/schema";
import { updateCabinetSettings, type ActionResult } from "./actions";

const initialState: ActionResult | null = null;

export function CabinetForm({
  initial,
}: {
  initial: CabinetSettings | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateCabinetSettings,
    initialState
  );

  return (
    <form action={formAction} className="space-y-8">
      <section className="space-y-2">
        <Label htmlFor="name">Nom du cabinet</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          defaultValue={initial?.name ?? "Cabinet"}
          placeholder="Votre cabinet"
          aria-invalid={state?.ok === false}
        />
        <p className="text-xs text-muted-foreground">
          Affiché dans l&apos;UI et utilisé par défaut dans le footer des
          documents générés via{" "}
          <code className="text-foreground">generate_document</code>.
        </p>
      </section>

      <section className="space-y-2">
        <Label htmlFor="footerText">Texte de footer des documents</Label>
        <Input
          id="footerText"
          name="footerText"
          maxLength={200}
          defaultValue={initial?.footerText ?? ""}
          placeholder="Votre cabinet · Confidentiel"
        />
        <p className="text-xs text-muted-foreground">
          Apparaît en pied de chaque page des DOCX/PDF générés, à gauche
          du numéro de page. Laisser vide pour ne pas en afficher.
        </p>
      </section>

      <section className="space-y-2">
        <Label htmlFor="legalDisclaimer">Mention légale par défaut</Label>
        <textarea
          id="legalDisclaimer"
          name="legalDisclaimer"
          rows={4}
          maxLength={1000}
          defaultValue={initial?.legalDisclaimer ?? ""}
          placeholder="Document généré par Louis. Ne constitue pas un conseil juridique personnalisé sans validation par un avocat."
          className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <p className="text-xs text-muted-foreground">
          Ajoutée en dernière page des documents générés. Vous pouvez la
          surcharger ponctuellement dans la conversation.
        </p>
      </section>

      {state?.ok === false && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.ok === true && (
        <Alert>
          <AlertDescription>Paramètres enregistrés.</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
