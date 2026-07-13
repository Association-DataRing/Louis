"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { saveOcrSettings } from "./actions";

type Key = { id: string; type: string; label: string };
type Mode = "auto" | "mistral" | "vision" | "tesseract";

const MODE_VALUES: Mode[] = ["auto", "mistral", "vision", "tesseract"];

export function OcrForm({
  initialMode,
  initialProviderKeyId,
  initialModelId,
  keys,
  hasMistral,
  visionSuggestions,
}: {
  initialMode: string;
  initialProviderKeyId: string | null;
  initialModelId: string | null;
  keys: Key[];
  hasMistral: boolean;
  visionSuggestions: Record<string, string[]>;
}) {
  const t = useTranslations("settings.ocr");
  const [mode, setMode] = useState<Mode>((initialMode as Mode) ?? "auto");
  const [providerKeyId, setProviderKeyId] = useState<string>(
    initialProviderKeyId ?? keys[0]?.id ?? ""
  );
  const [modelId, setModelId] = useState<string>(initialModelId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const selectedKeyType = useMemo(
    () => keys.find((k) => k.id === providerKeyId)?.type ?? "",
    [keys, providerKeyId]
  );
  const suggestions = visionSuggestions[selectedKeyType] ?? [];

  function onSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await saveOcrSettings(null, formData);
      if (result.ok) setSuccess(true);
      else setError(result.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="sr-only">{t("legend")}</legend>
        {MODE_VALUES.map((value) => (
          <label
            key={value}
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
              mode === value
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-accent/40"
            }`}
          >
            <input
              type="radio"
              name="mode"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                {t(`mode.${value}.title`)}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t(`mode.${value}.desc`)}
              </span>
              {value === "mistral" && !hasMistral && (
                <span className="mt-1 block text-xs text-amber-600 dark:text-amber-500">
                  {t("noMistralKey")}
                </span>
              )}
            </span>
          </label>
        ))}
      </fieldset>

      {/* Picker du mode vision */}
      {mode === "vision" && (
        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.rich("noProviderKey", {
                providers: (chunks) => (
                  <a className="underline" href="/settings/providers">
                    {chunks}
                  </a>
                ),
              })}
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="providerKeyId">{t("providerKeyLabel")}</Label>
                <select
                  id="providerKeyId"
                  name="providerKeyId"
                  value={providerKeyId}
                  onChange={(e) => setProviderKeyId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {keys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label} ({k.type})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="modelId">{t("modelLabel")}</Label>
                <Input
                  id="modelId"
                  name="modelId"
                  list="ocr-model-suggestions"
                  placeholder={suggestions[0] ?? t("modelPlaceholder")}
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                />
                <datalist id="ocr-model-suggestions">
                  {suggestions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  {t("modelHint", {
                    suggestions: suggestions.length
                      ? suggestions.join(", ")
                      : "—",
                  })}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{t("saved")}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
