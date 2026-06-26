"use client";

import { useState } from "react";
import {
  IconCopy,
  IconCheck,
  IconRefresh,
  IconArrowsExchange,
  IconGitFork,
} from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ModelOption = {
  id: string;
  label: string;
  /** Affichage discret du provider/souveraineté. Optionnel. */
  hint?: string | null;
};

type Props = {
  /** Texte brut markdown du message, pour la copie clipboard. */
  text: string;
  /** Modèle courant — pour griser l'entrée dans le sub-menu « Régénérer avec ». */
  currentModelId: string;
  /** Modèles dispo pour le swap. Vide → on cache le sub-menu. */
  availableModels: ModelOption[];
  onRegenerate: () => void;
  onRegenerateWith: (modelId: string) => void;
  /** Forke la conversation jusqu'à ce message inclus. Caché si absent. */
  onFork?: () => void;
  disabled?: boolean;
};

/**
 * Actions disponibles au survol d'un message assistant : copier le markdown,
 * régénérer avec le même modèle, ou regénérer avec un autre modèle. Inspiré
 * du menu d'actions de claude.ai et chatgpt — apparaît au hover sans
 * encombrer la lecture.
 */
export function AssistantMessageActions({
  text,
  currentModelId,
  availableModels,
  onRegenerate,
  onRegenerateWith,
  onFork,
  disabled = false,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard refusée (contexte non sécurisé, permission denied) —
      // on ignore silencieusement, l'utilisateur peut toujours sélectionner
      // le texte manuellement.
    }
  }

  return (
    <div className="flex items-center gap-1 text-muted-foreground">
      <button
        type="button"
        onClick={handleCopy}
        disabled={disabled}
        title={copied ? "Copié" : "Copier la réponse"}
        aria-label={copied ? "Copié" : "Copier la réponse"}
        className="inline-flex items-center justify-center size-7 rounded-md hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
      >
        {copied ? (
          <IconCheck className="size-3.5 text-success" />
        ) : (
          <IconCopy className="size-3.5" />
        )}
      </button>
      <button
        type="button"
        onClick={onRegenerate}
        disabled={disabled}
        title="Régénérer cette réponse"
        aria-label="Régénérer cette réponse"
        className="inline-flex items-center justify-center size-7 rounded-md hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
      >
        <IconRefresh className="size-3.5" />
      </button>
      {onFork && (
        <button
          type="button"
          onClick={onFork}
          disabled={disabled}
          title="Forker la conversation à partir d'ici"
          aria-label="Forker la conversation à partir d'ici"
          className="inline-flex items-center justify-center size-7 rounded-md hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
        >
          <IconGitFork className="size-3.5" />
        </button>
      )}
      {availableModels.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={disabled}
            title="Régénérer avec un autre modèle"
            aria-label="Régénérer avec un autre modèle"
            className="inline-flex items-center justify-center size-7 rounded-md hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
          >
            <IconArrowsExchange className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Régénérer avec
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableModels.slice(0, 12).map((m) => (
              <DropdownMenuItem
                key={m.id}
                onSelect={() => onRegenerateWith(m.id)}
                disabled={m.id === currentModelId}
                className={
                  m.id === currentModelId ? "opacity-60" : "flex-col items-start gap-0.5"
                }
              >
                <span className="text-sm">{m.label}</span>
                {m.hint && (
                  <span className="text-[10px] text-muted-foreground">
                    {m.hint}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
            {availableModels.length > 12 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">
                  {availableModels.length - 12} modèles supplémentaires —
                  changez de modèle dans le composer
                </DropdownMenuLabel>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/**
 * Extrait le texte markdown concaténé des parts text d'un message UI —
 * utilisé pour alimenter la copie clipboard. Ignore les tool-parts et
 * data-events (visualisation pure).
 */
export function extractTextFromParts(
  parts: { type: string; text?: string }[]
): string {
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n\n")
    .trim();
}

