"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconArrowRight, IconCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProviderKeyForm } from "@/components/provider-key-form";
import { cn } from "@/lib/utils";
import { activateDefaultModels, createFirstAdmin } from "./actions";

type Step = "account" | "provider" | "done";

const STEPS: { id: Step; label: string }[] = [
  { id: "account", label: "Votre compte" },
  { id: "provider", label: "Intelligence" },
  { id: "done", label: "Prêt" },
];

/** Entrée commune des étapes — convention Louis : tw-animate + motion-safe. */
const stepEnter =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300";

export function SetupWizard({
  initialStep = "account",
}: {
  /** "provider" quand le compte admin existe déjà (reprise du wizard). */
  initialStep?: Extract<Step, "account" | "provider">;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const [skippedProvider, setSkippedProvider] = useState(false);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);
  const [modelCount, setModelCount] = useState<number | null>(null);

  return (
    <div className="w-full max-w-xl">
      <StepRail current={step} />

      {step === "account" && (
        <AccountStep onDone={() => setStep("provider")} />
      )}
      {step === "provider" && (
        <section className={stepEnter}>
          <h1 className="font-heading text-4xl tracking-tight">
            Connectez votre intelligence.
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Louis fonctionne avec vos propres clés API —{" "}
            <strong className="font-medium text-foreground">
              elles ne quittent jamais votre instance
            </strong>
            . Choisissez un provider, collez votre clé : Louis la teste avant
            de l&apos;enregistrer.
          </p>
          <div className="mt-8">
            <ProviderKeyForm
              idPrefix="setup"
              onSuccess={async (label) => {
                setProviderLabel(label);
                setStep("done");
                // Active le catalogue de modèles en arrière-plan : l'écran
                // final affiche le compte dès qu'il est connu.
                try {
                  setModelCount(await activateDefaultModels());
                } catch {
                  setModelCount(null);
                }
              }}
              secondary={
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSkippedProvider(true);
                    setStep("done");
                  }}
                  className="h-11 text-sm text-muted-foreground"
                >
                  Plus tard
                </Button>
              }
            />
          </div>
        </section>
      )}
      {step === "done" && (
        <DoneStep
          skippedProvider={skippedProvider}
          providerLabel={providerLabel}
          modelCount={modelCount}
          onOpen={() => router.push(skippedProvider ? "/dashboard" : "/chat")}
        />
      )}
    </div>
  );
}

function StepRail({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="mb-10 flex items-center gap-5" aria-label="Progression">
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={s.id} className="flex items-center gap-2.5">
            {done ? (
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                <IconCheck className="size-3.5" />
              </span>
            ) : (
              <span
                className={cn(
                  "font-heading text-xl tabular-nums leading-none",
                  active ? "text-foreground" : "text-muted-foreground/50"
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
            )}
            <span
              className={cn(
                "text-sm",
                active
                  ? "font-medium text-foreground"
                  : "text-muted-foreground/70"
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className="ml-2.5 h-px w-8 bg-border sm:w-12"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function AccountStep({ onDone }: { onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const pwOk = password.length >= 12;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      // Succès = signIn redirige vers /setup (cookie posé) et cette promesse
      // ne « revient » pas : seul le cas d'erreur produit un résultat.
      const result = await createFirstAdmin(null, formData);
      if (!result) return;
      if (result.ok) onDone();
      else setError(result.error);
    });
  }

  return (
    <section className={stepEnter}>
      <h1 className="font-heading text-4xl tracking-tight">
        Bienvenue sur Louis.
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        Cette instance vous appartient. Commençons par créer votre compte
        administrateur — il contrôle les membres, les quotas et la
        configuration.
      </p>

      <form action={handleSubmit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="setup-name">Votre nom</Label>
          <Input
            id="setup-name"
            name="name"
            required
            autoFocus
            maxLength={120}
            autoComplete="name"
            className="h-11"
            placeholder="Marie Dupont"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="setup-email">Adresse e-mail</Label>
          <Input
            id="setup-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-11"
            placeholder="vous@cabinet.fr"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="setup-password">Mot de passe</Label>
          <Input
            id="setup-password"
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            className="h-11"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="setup-password-hint"
          />
          <p
            id="setup-password-hint"
            className={cn(
              "text-xs transition-colors",
              pwOk ? "text-success" : "text-muted-foreground"
            )}
          >
            {pwOk ? (
              <span className="inline-flex items-center gap-1">
                <IconCheck className="size-3" />
                Longueur suffisante
              </span>
            ) : (
              `12 caractères minimum — encore ${12 - password.length}.`
            )}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          disabled={pending || !pwOk}
          className="h-11 w-full text-sm"
        >
          {pending ? "Création…" : "Créer mon compte"}
          {!pending && <IconArrowRight className="size-4" />}
        </Button>
      </form>
    </section>
  );
}

function DoneStep({
  skippedProvider,
  providerLabel,
  modelCount,
  onOpen,
}: {
  skippedProvider: boolean;
  providerLabel: string | null;
  modelCount: number | null;
  onOpen: () => void;
}) {
  const items = [
    "Compte administrateur créé",
    ...(providerLabel
      ? [
          `Clé ${providerLabel} testée et chiffrée`,
          modelCount
            ? `${modelCount} modèle${modelCount > 1 ? "s" : ""} prêt${modelCount > 1 ? "s" : ""} à l'emploi`
            : "Catalogue de modèles activé",
        ]
      : []),
  ];

  return (
    <section className={stepEnter}>
      <h1 className="font-heading text-4xl tracking-tight">Louis est prêt.</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        {skippedProvider
          ? "Votre compte est créé. Il restera à connecter une clé IA depuis les réglages pour commencer à converser."
          : "Tout est en place. Posez votre première question — vos documents, vos sources et vos agents suivront."}
      </p>

      <ul className="mt-8 space-y-3">
        {items.map((label) => (
          <li key={label} className="flex items-center gap-2.5 text-sm">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success/15 text-success">
              <IconCheck className="size-3.5" />
            </span>
            {label}
          </li>
        ))}
      </ul>

      <Button onClick={onOpen} className="mt-10 h-11 w-full text-sm">
        {skippedProvider ? "Ouvrir le tableau de bord" : "Commencer à converser"}
        <IconArrowRight className="size-4" />
      </Button>
    </section>
  );
}
