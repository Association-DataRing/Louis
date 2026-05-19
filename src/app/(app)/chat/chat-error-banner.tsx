"use client";

import Link from "next/link";
import {
  IconAlertTriangle,
  IconRefresh,
  IconExternalLink,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface ChatErrorBannerProps {
  error: Error;
  onRetry?: () => void;
}

interface ParsedError {
  title: string;
  description: string;
  hint?: string;
  hintHref?: string;
  hintLabel?: string;
}

/**
 * Mappe les erreurs courantes AI SDK / provider vers des messages
 * actionnables en français. Fallback générique si pattern non reconnu.
 *
 * Codes Mistral récurrents :
 * - 3505 service_tier_capacity_exceeded
 * - 429 rate_limit_exceeded
 *
 * Codes OpenAI / Anthropic :
 * - 401 invalid_api_key
 * - 429 rate_limit_exceeded
 * - 529 overloaded
 */
function parseError(err: Error): ParsedError {
  const msg = err.message || "";

  // Mistral capacity / rate limit
  if (
    /service.?tier.?capacity/i.test(msg) ||
    /3505/.test(msg)
  ) {
    return {
      title: "Le modèle est saturé",
      description:
        "Le provider (Mistral, OpenAI…) refuse temporairement les requêtes — sa capacité de service est dépassée. C'est fréquent en heure de pointe sur les tiers gratuits/standard.",
      hint: "Réessayez dans 20-30 secondes, ou changez de modèle/provider (un agent en Claude/GPT au lieu de Mistral par exemple).",
      hintHref: "/settings/providers",
      hintLabel: "Voir mes providers",
    };
  }

  // Rate limit générique
  if (/rate.?limit|429/i.test(msg) || /quota/i.test(msg)) {
    return {
      title: "Trop de requêtes",
      description:
        "Vous avez atteint la limite de votre provider. Patientez quelques secondes avant de réessayer.",
      hint: "Si ça persiste, vérifiez votre plan provider ou ajoutez une clé alternative.",
      hintHref: "/settings/providers",
      hintLabel: "Mes providers",
    };
  }

  // Clé invalide
  if (/api.?key|401|unauthor/i.test(msg)) {
    return {
      title: "Clé provider invalide",
      description:
        "Le provider refuse votre clé d'accès. Vérifiez qu'elle est encore valide et active.",
      hintHref: "/settings/providers",
      hintLabel: "Vérifier ma clé",
    };
  }

  // Modèle introuvable / non-supporté
  if (/model.?not.?found|invalid.?model/i.test(msg)) {
    return {
      title: "Modèle introuvable",
      description:
        "Le modèle sélectionné n'est pas disponible chez ce provider. Choisissez un autre modèle dans le sélecteur.",
    };
  }

  // Overload (Anthropic 529)
  if (/overload|529/i.test(msg)) {
    return {
      title: "Le provider est surchargé",
      description:
        "Anthropic ou OpenAI signale une surcharge globale. Réessayez dans une minute.",
    };
  }

  // No output (stream vide)
  if (/no.?output.?generated/i.test(msg)) {
    return {
      title: "Le modèle n'a rien produit",
      description:
        "Le stream s'est terminé sans générer de réponse. Souvent dû à un timeout du provider ou à un prompt qui sature le contexte. Réessayez, ou raccourcissez votre question.",
    };
  }

  // Fallback générique
  return {
    title: "Une erreur est survenue",
    description: msg || "Erreur inconnue lors de la communication avec le provider.",
  };
}

export function ChatErrorBanner({ error, onRetry }: ChatErrorBannerProps) {
  const parsed = parseError(error);

  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm flex items-start gap-3"
    >
      <IconAlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="font-medium text-foreground">{parsed.title}</p>
          <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
            {parsed.description}
          </p>
          {parsed.hint && (
            <p className="mt-2 text-xs text-muted-foreground italic">
              {parsed.hint}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center pt-1">
          {onRetry && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRetry}
              className="h-8"
            >
              <IconRefresh className="size-3.5" />
              Réessayer
            </Button>
          )}
          {parsed.hintHref && parsed.hintLabel && (
            <Link
              href={parsed.hintHref}
              className="inline-flex items-center gap-1 text-xs text-foreground/70 hover:text-foreground transition-colors h-8 px-2"
            >
              <IconExternalLink className="size-3.5" />
              {parsed.hintLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
