import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { ocrSettings, providerKeys } from "@/db/schema";
import { planOcr } from "@/lib/ocr";
import { OcrForm } from "./ocr-form";

// Suggestions de modèles VISION-capable par provider (pour le picker du mode
// vision). Liste indicative — l'utilisateur peut saisir n'importe quel id.
const VISION_SUGGESTIONS: Record<string, string[]> = {
  mistral: ["pixtral-large-latest", "pixtral-12b-latest"],
  openrouter: [
    "mistralai/pixtral-large-2411",
    "openai/gpt-4o",
    "anthropic/claude-3.5-sonnet",
    "qwen/qwen-2.5-vl-72b-instruct",
    "google/gemini-2.5-pro",
  ],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1"],
  anthropic: ["claude-sonnet-4-7", "claude-opus-4-7"],
  scaleway: ["pixtral-12b-2409"],
  openai_compatible: [],
  ovh: [],
  albert: [],
};

const ENGINE_LABEL: Record<string, string> = {
  mistral: "Mistral OCR (endpoint dédié)",
  vision: "Modèle de vision",
  tesseract: "Tesseract local (souverain)",
};

export default async function OcrSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const [[setting], keys, plan] = await Promise.all([
    db.select().from(ocrSettings).where(eq(ocrSettings.userId, userId)).limit(1),
    db
      .select({
        id: providerKeys.id,
        type: providerKeys.type,
        label: providerKeys.label,
      })
      .from(providerKeys)
      .where(
        and(eq(providerKeys.userId, userId), eq(providerKeys.isActive, true))
      )
      .orderBy(desc(providerKeys.isDefault), desc(providerKeys.createdAt)),
    planOcr(userId),
  ]);

  const hasMistral = keys.some((k) => k.type === "mistral");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-8">
        <h1 className="font-heading text-3xl tracking-tight">OCR des PDF scannés</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Les PDF à couche texte sont convertis en Markdown 100&nbsp;% localement.
          Les PDF scannés (images) nécessitent de l&apos;OCR : choisissez le moteur,
          ou laissez Louis décider automatiquement.
        </p>
      </header>

      {/* Moteur effectif actuel */}
      <div
        className={`mb-8 rounded-lg border px-4 py-3 text-sm ${
          plan.degraded
            ? "border-amber-500/40 bg-amber-500/10"
            : "border-border bg-card"
        }`}
      >
        <p className="font-medium">
          Moteur actuellement utilisé : {ENGINE_LABEL[plan.engine]}
          {plan.modelId ? ` — ${plan.modelId}` : ""}
        </p>
        {plan.degraded && (
          <p className="mt-1 text-muted-foreground">
            Aucune clé OCR/vision configurée : Louis utilise Tesseract local
            (souverain et gratuit, mais de qualité moindre sur le juridique,
            les tableaux et le manuscrit). Pour une bien meilleure qualité,
            ajoutez une clé Mistral (OCR dédié) ou une clé d&apos;un provider
            vision (OpenRouter, OpenAI, Anthropic…) dans{" "}
            <a className="underline" href="/settings/providers">
              Providers
            </a>
            .
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <OcrForm
          initialMode={setting?.mode ?? "auto"}
          initialProviderKeyId={setting?.providerKeyId ?? null}
          initialModelId={setting?.modelId ?? null}
          keys={keys}
          hasMistral={hasMistral}
          visionSuggestions={VISION_SUGGESTIONS}
        />
      </div>
    </main>
  );
}
