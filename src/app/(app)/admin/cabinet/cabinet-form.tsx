"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("admin.cabinet");
  const [state, formAction, pending] = useActionState(
    updateCabinetSettings,
    initialState
  );

  return (
    <form action={formAction} className="space-y-8">
      <section className="space-y-2">
        <Label htmlFor="name">{t("nameLabel")}</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          defaultValue={initial?.name ?? "Cabinet"}
          placeholder={t("namePlaceholder")}
          aria-invalid={state?.ok === false}
        />
        <p className="text-xs text-muted-foreground">
          {t.rich("nameHelp", {
            code: (chunks) => (
              <code className="text-foreground">{chunks}</code>
            ),
          })}
        </p>
      </section>

      <section className="space-y-2">
        <Label htmlFor="footerText">{t("footerLabel")}</Label>
        <Input
          id="footerText"
          name="footerText"
          maxLength={200}
          defaultValue={initial?.footerText ?? ""}
          placeholder={t("footerPlaceholder")}
        />
        <p className="text-xs text-muted-foreground">{t("footerHelp")}</p>
      </section>

      <section className="space-y-2">
        <Label htmlFor="legalDisclaimer">{t("disclaimerLabel")}</Label>
        <textarea
          id="legalDisclaimer"
          name="legalDisclaimer"
          rows={4}
          maxLength={1000}
          defaultValue={initial?.legalDisclaimer ?? ""}
          placeholder={t("disclaimerPlaceholder")}
          className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p className="text-xs text-muted-foreground">{t("disclaimerHelp")}</p>
      </section>

      {state?.ok === false && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.ok === true && (
        <Alert>
          <AlertDescription>{t("saved")}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
