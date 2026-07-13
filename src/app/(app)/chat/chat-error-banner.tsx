"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
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
  /** Clé du sous-namespace `errors` (titre/description/hint résolus chez le consommateur). */
  key: string;
  hintHref?: string;
  /** Message brut du provider — utilisé comme description pour le cas générique. */
  rawMessage?: string;
}

/**
 * Mappe les erreurs courantes AI SDK / provider vers une clé i18n
 * actionnable. Fallback générique si pattern non reconnu.
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
    return { key: "saturated", hintHref: "/settings/providers" };
  }

  // Rate limit générique
  if (/rate.?limit|429/i.test(msg) || /quota/i.test(msg)) {
    return { key: "rateLimit", hintHref: "/settings/providers" };
  }

  // Clé invalide
  if (/api.?key|401|unauthor/i.test(msg)) {
    return { key: "invalidKey", hintHref: "/settings/providers" };
  }

  // Modèle introuvable / non-supporté
  if (/model.?not.?found|invalid.?model/i.test(msg)) {
    return { key: "modelNotFound" };
  }

  // Overload (Anthropic 529)
  if (/overload|529/i.test(msg)) {
    return { key: "overload" };
  }

  // No output (stream vide)
  if (/no.?output.?generated/i.test(msg)) {
    return { key: "noOutput" };
  }

  // OpenAI Responses API : mismatch entre function_call et function_call_output
  // dans l'historique envoyé. Le tour précédent a été interrompu pendant
  // un tool call ou la sérialisation des messages a perdu un function_call.
  if (/No tool call found for function call output/i.test(msg)) {
    return { key: "incoherentHistory", hintHref: "/chat" };
  }

  // Erreur générique OpenRouter (le provider downstream a échoué sans
  // détail spécifique). On reste explicite sur le diagnostic.
  if (/Provider returned error/i.test(msg)) {
    return { key: "providerRefused", hintHref: "/settings/models" };
  }

  // Network / timeout côté client.
  if (/network|fetch failed|ECONNRESET|ETIMEDOUT|timeout/i.test(msg)) {
    return { key: "network" };
  }

  // Fallback générique
  return { key: "generic", rawMessage: msg || undefined };
}

export function ChatErrorBanner({ error, onRetry }: ChatErrorBannerProps) {
  const t = useTranslations("chat");
  const parsed = parseError(error);
  const base = `errors.${parsed.key}`;
  const title = t(`${base}.title`);
  const description =
    parsed.key === "generic" && parsed.rawMessage
      ? parsed.rawMessage
      : t(`${base}.description`);
  const hint = t.has(`${base}.hint`) ? t(`${base}.hint`) : undefined;
  const hintLabel =
    parsed.hintHref && t.has(`${base}.hintLabel`)
      ? t(`${base}.hintLabel`)
      : undefined;

  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm flex items-start gap-3"
    >
      <IconAlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
            {description}
          </p>
          {hint && (
            <p className="mt-2 text-xs text-muted-foreground italic">
              {hint}
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
              {t("errors.retry")}
            </Button>
          )}
          {parsed.hintHref && hintLabel && (
            <Link
              href={parsed.hintHref}
              className="inline-flex items-center gap-1 text-xs text-foreground/70 hover:text-foreground transition-colors h-8 px-2"
            >
              <IconExternalLink className="size-3.5" />
              {hintLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
