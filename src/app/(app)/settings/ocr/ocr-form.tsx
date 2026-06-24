"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { saveOcrSettings } from "./actions";

type Key = { id: string; type: string; label: string };
type Mode = "auto" | "mistral" | "vision" | "tesseract";

const MODES: { value: Mode; title: string; desc: string }[] = [
  {
    value: "auto",
    title: "Automatique (recommandé)",
    desc: "Mistral OCR si clé Mistral → sinon un modèle de vision via une clé disponible → sinon Tesseract local.",
  },
  {
    value: "mistral",
    title: "Mistral OCR (endpoint dédié)",
    desc: "Meilleure qualité/coût sur du document. Nécessite une clé Mistral active.",
  },
  {
    value: "vision",
    title: "Modèle de vision (au choix)",
    desc: "OCR via un modèle multimodal de votre choix (Pixtral via OpenRouter, GPT-4o, Claude…).",
  },
  {
    value: "tesseract",
    title: "Tesseract local (souverain)",
    desc: "100 % local, gratuit, hors-ligne. Qualité moindre sur tableaux et manuscrit.",
  },
];

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
        <legend className="sr-only">Moteur OCR</legend>
        {MODES.map((m) => (
          <label
            key={m.value}
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
              mode === m.value
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-accent/40"
            }`}
          >
            <input
              type="radio"
              name="mode"
              value={m.value}
              checked={mode === m.value}
              onChange={() => setMode(m.value)}
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{m.title}</span>
              <span className="block text-xs text-muted-foreground">
                {m.desc}
              </span>
              {m.value === "mistral" && !hasMistral && (
                <span className="mt-1 block text-xs text-amber-600 dark:text-amber-500">
                  Aucune clé Mistral active — repli sur Tesseract tant qu&apos;elle
                  n&apos;est pas ajoutée.
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
              Aucune clé provider active. Ajoutez-en une dans{" "}
              <a className="underline" href="/settings/providers">
                Providers
              </a>{" "}
              pour utiliser un modèle de vision.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="providerKeyId">Clé provider</Label>
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
                <Label htmlFor="modelId">Modèle (vision-capable)</Label>
                <Input
                  id="modelId"
                  name="modelId"
                  list="ocr-model-suggestions"
                  placeholder={suggestions[0] ?? "ex. mistralai/pixtral-large-2411"}
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                />
                <datalist id="ocr-model-suggestions">
                  {suggestions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Le modèle doit accepter les images. Suggestions pour ce
                  provider&nbsp;: {suggestions.length ? suggestions.join(", ") : "—"}.
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
          <AlertDescription>Réglage OCR enregistré.</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
