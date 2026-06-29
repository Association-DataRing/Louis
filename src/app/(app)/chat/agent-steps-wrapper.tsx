"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { IconChevronDown } from "@tabler/icons-react";

type Props = {
  children: ReactNode;
  /** Nombre d'étapes en cours (badges agrégés). Affiché en cours et en final. */
  stepCount: number;
  /**
   * Le wrapper devrait se replier — typiquement quand du contenu textuel
   * a commencé à apparaître après les étapes. La logique de latch interne
   * empêche que le wrapper se re-déplie si ce flag passe brièvement à
   * `false` (ex. transition entre status streaming et idle).
   */
  shouldMinimize: boolean;
  isStreaming: boolean;
};

/**
 * Conteneur agrégateur qui regroupe les étapes d'exécution d'agents (badges)
 * dans un cadre dépliable. Pendant le streaming, affiche « Travail en cours »
 * avec 3 dots staggered. Une fois que la réponse arrive ou que le stream
 * se termine, se replie en « Terminé en N étapes » et l'utilisateur peut
 * cliquer pour ré-ouvrir.
 *
 * Le latch `hasMinimizedRef` est essentiel : sans lui, le wrapper "pop-ouvre"
 * brièvement à la fin du stream quand isStreaming bascule de true à false
 * avant que shouldMinimize ne s'active.
 */
export function AgentStepsWrapper({
  children,
  stepCount,
  shouldMinimize,
  isStreaming,
}: Props) {
  const t = useTranslations("chat");
  const [userToggled, setUserToggled] = useState(false);
  const [isOpen, setIsOpen] = useState(!shouldMinimize);
  const hasMinimizedRef = useRef(shouldMinimize);

  useEffect(() => {
    if (shouldMinimize) hasMinimizedRef.current = true;
    if (userToggled) return;
    setIsOpen(!shouldMinimize && !hasMinimizedRef.current);
  }, [shouldMinimize, userToggled]);

  const label = isStreaming
    ? t("agentSteps.working")
    : t("agentSteps.doneInSteps", { count: stepCount });

  return (
    <div className="rounded-lg border border-border bg-card/40 px-3 py-2">
      <button
        type="button"
        onClick={() => {
          setUserToggled(true);
          setIsOpen((v) => !v);
        }}
        className="w-full flex items-center justify-between font-heading text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-baseline min-w-0">
          <span className="truncate">{label}</span>
          {isStreaming && (
            <span className="inline-flex ml-1.5 shrink-0 items-baseline">
              <span className="size-0.5 rounded-full bg-muted-foreground/60 mr-0.5 animate-[bounce_1.4s_infinite_0s]" />
              <span className="size-0.5 rounded-full bg-muted-foreground/60 mr-0.5 animate-[bounce_1.4s_infinite_0.2s]" />
              <span className="size-0.5 rounded-full bg-muted-foreground/60 animate-[bounce_1.4s_infinite_0.4s]" />
            </span>
          )}
        </span>
        <IconChevronDown
          className={`size-3 shrink-0 ml-2 transition-transform duration-200 ${
            isOpen ? "" : "-rotate-90"
          }`}
        />
      </button>
      {isOpen && (
        <div className="mt-3 flex flex-col gap-3 relative">{children}</div>
      )}
    </div>
  );
}
