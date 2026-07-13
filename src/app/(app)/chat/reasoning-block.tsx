"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  IconChevronDown,
  IconBulb,
  IconLoader2,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

/**
 * Bloc de raisonnement d'un modèle « thinking » (DeepSeek R1, Magistral,
 * o-series, Claude extended thinking, QwQ…). L'AI SDK émet ces tokens comme
 * des parts `reasoning` distinctes du texte de réponse final.
 *
 * Repliable, fermé par défaut (le raisonnement est un détail de progression,
 * pas le signal principal). Pendant le streaming on affiche une ligne
 * d'aperçu (dernière phrase) avec un léger shimmer pour signaler l'activité ;
 * une fois terminé, on bascule sur un libellé sobre « Raisonnement ».
 *
 * Inspiré de la vue d'activité de vLLM Studio, adapté à l'esthétique Louis.
 */
export function ReasoningBlock({
  text,
  isStreaming,
}: {
  text: string;
  isStreaming: boolean;
}) {
  const t = useTranslations("chat");
  const [expanded, setExpanded] = useState(false);

  const trimmed = text.trim();
  if (!trimmed) return null;

  // Aperçu : la dernière ligne non vide, tronquée. Donne un aperçu vivant du
  // fil de pensée en cours sans déplier tout le bloc.
  const preview = lastLine(trimmed, 120);

  return (
    <details
      className="group/reason w-full min-w-0"
      open={expanded}
    >
      <summary
        onClick={(e) => {
          e.preventDefault();
          setExpanded((v) => !v);
        }}
        className="flex min-h-7 cursor-pointer list-none items-center gap-2 rounded-md py-1 text-sm text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden"
      >
        {isStreaming ? (
          <IconLoader2 className="size-3.5 shrink-0 animate-spin text-foreground/60" />
        ) : (
          <IconBulb className="size-3.5 shrink-0 text-foreground/55" />
        )}
        <span className="shrink-0 font-medium text-foreground/70">
          {isStreaming ? t("reasoning.thinking") : t("reasoning.label")}
        </span>
        {!expanded && isStreaming && preview && (
          <span
            className="reasoning-shimmer min-w-0 flex-1 truncate text-xs text-muted-foreground/70"
            aria-hidden
          >
            {preview}
          </span>
        )}
        {!expanded && !isStreaming && (
          <span className="min-w-0 flex-1" />
        )}
        <IconChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground/50 transition-transform",
            expanded ? "" : "-rotate-90"
          )}
        />
      </summary>
      <div className="ml-1.5 mt-1.5 border-l border-border/60 pl-3">
        <pre className="max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/40 px-3 py-2 font-mono text-xs leading-[1.6] text-muted-foreground/85">
          {trimmed}
        </pre>
      </div>
    </details>
  );
}

/** Dernière ligne non vide d'un texte, tronquée à `max` caractères. */
function lastLine(text: string, max: number): string {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line) {
      return line.length > max ? `${line.slice(0, max)}…` : line;
    }
  }
  return "";
}
