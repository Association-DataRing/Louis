"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  IconArrowRight,
  IconExternalLink,
  IconShieldLock,
  IconSparkles,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  PROVIDER_CATALOG,
  PROVIDER_TYPES,
  SOVEREIGNTY_LABEL,
  type ProviderType,
} from "@/lib/providers/catalog";
import { cn } from "@/lib/utils";
import {
  createProviderKeyTested,
  type TestedCreateResult,
} from "@/app/(app)/settings/providers/actions";

/**
 * Formulaire « première clé provider » partagé entre l'assistant /setup et le
 * quick-add du chat : sélecteur visuel de provider (badge de souveraineté,
 * Mistral conseillé), collage de la clé, test AVANT enregistrement.
 */
export function ProviderKeyForm({
  onSuccess,
  secondary,
  idPrefix = "pkf",
}: {
  onSuccess: (providerLabel: string) => void | Promise<void>;
  /** Slot optionnel à droite du bouton de soumission (ex. « Plus tard »). */
  secondary?: ReactNode;
  /** Préfixe des ids de champs — évite les collisions si deux formulaires coexistent. */
  idPrefix?: string;
}) {
  const t = useTranslations("components");
  const [selected, setSelected] = useState<ProviderType>("mistral");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TestedCreateResult | null>(null);
  const meta = PROVIDER_CATALOG[selected];

  function handleSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const r = await createProviderKeyTested(null, formData);
      if (r.ok) await onSuccess(meta.label);
      else setResult(r);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <input type="hidden" name="type" value={selected} />
      <input
        type="hidden"
        name="label"
        value={t("providerKeyForm.keyLabel", { provider: meta.label })}
      />

      <fieldset>
        <legend className="sr-only">{t("providerKeyForm.legend")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDER_TYPES.map((type) => {
            const m = PROVIDER_CATALOG[type];
            const active = type === selected;
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setSelected(type);
                  setResult(null);
                }}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/40"
                )}
              >
                <span
                  aria-hidden
                  className="relative size-8 shrink-0 overflow-hidden rounded-md"
                  style={{ background: m.accent }}
                >
                  <span
                    className="absolute inset-1.5"
                    style={{
                      WebkitMaskImage: `url(${m.logo})`,
                      maskImage: `url(${m.logo})`,
                      WebkitMaskRepeat: "no-repeat",
                      maskRepeat: "no-repeat",
                      WebkitMaskPosition: "center",
                      maskPosition: "center",
                      WebkitMaskSize: "contain",
                      maskSize: "contain",
                      backgroundColor: m.logoTint,
                    }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium leading-tight">
                    {m.label}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {SOVEREIGNTY_LABEL[m.sovereignty]}
                    </span>
                    {type === "mistral" && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary">
                        <IconSparkles className="size-2.5" />
                        {t("providerKeyForm.recommended")}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {selected === "mistral" && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("providerKeyForm.mistralHint")}
          </p>
        )}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-apikey`}>
          {t("providerKeyForm.apiKeyLabel", { provider: meta.label })}
        </Label>
        <Input
          id={`${idPrefix}-apikey`}
          name="apiKey"
          type="password"
          required
          autoComplete="off"
          className="h-11 font-mono"
          placeholder={t("providerKeyForm.apiKeyPlaceholder")}
        />
        <a
          href={meta.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
        >
          {t("providerKeyForm.getKey", { provider: meta.label })}
          <IconExternalLink className="size-3" />
        </a>
      </div>

      {meta.requiresBaseUrl && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-baseurl`}>
            {t("providerKeyForm.baseUrlLabel")}
          </Label>
          <Input
            id={`${idPrefix}-baseurl`}
            name="baseUrl"
            type="url"
            required
            className="h-11"
            placeholder={meta.baseUrlPlaceholder ?? "https://…"}
          />
          {meta.baseUrlHelp && (
            <p className="text-xs text-muted-foreground">{meta.baseUrlHelp}</p>
          )}
        </div>
      )}

      {result && !result.ok && (
        <Alert variant="destructive">
          <AlertDescription>
            {result.error}
            {result.canForce && (
              <button
                type="submit"
                name="force"
                value="true"
                disabled={pending}
                className="ml-1 font-medium underline underline-offset-2"
              >
                {t("providerKeyForm.saveWithoutTest")}
              </button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={pending} className="h-11 flex-1 text-sm">
          {pending
            ? t("providerKeyForm.testing")
            : t("providerKeyForm.testAndSave")}
          {!pending && <IconArrowRight className="size-4" />}
        </Button>
        {secondary}
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <IconShieldLock className="mt-px size-3.5 shrink-0 text-primary" />
        {t("providerKeyForm.encryptionNote")}
      </p>
    </form>
  );
}
