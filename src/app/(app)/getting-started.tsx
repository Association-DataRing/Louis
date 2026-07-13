"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { IconCheck, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type OnboardingState = {
  provider: boolean;
  model: boolean;
  document: boolean;
  conversation: boolean;
};

const DISMISS_KEY = "louis:gettingStartedDismissed";
const DISMISS_EVENT = "louis:gettingStartedDismissed-change";

function subscribe(cb: () => void) {
  window.addEventListener(DISMISS_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(DISMISS_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): string {
  return window.localStorage.getItem(DISMISS_KEY) ?? "false";
}

// Côté serveur on considère la carte masquée : elle apparaît après
// hydratation seulement si l'utilisateur ne l'a pas écartée — évite le
// flash « carte affichée puis retirée » au chargement.
function getServerSnapshot(): string {
  return "true";
}

const STEPS: {
  key: keyof OnboardingState;
  labelKey: string;
  href: string;
}[] = [
  { key: "provider", labelKey: "stepProvider", href: "/settings/providers" },
  { key: "model", labelKey: "stepModel", href: "/settings/models/library" },
  { key: "document", labelKey: "stepDocument", href: "/documents" },
  { key: "conversation", labelKey: "stepConversation", href: "/chat" },
];

/**
 * Carte « Prise en main » persistante de la sidebar. Contrairement à la
 * checklist du dashboard (qui disparaît dès provider+modèle configurés),
 * celle-ci accompagne l'utilisateur jusqu'à sa première conversation, survit
 * aux sessions, et reste écartable d'un clic (localStorage).
 */
export function GettingStarted({
  state,
  onNavigate,
}: {
  state: OnboardingState;
  onNavigate?: () => void;
}) {
  const t = useTranslations("gettingStarted");
  const dismissed =
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) === "true";

  const doneCount = STEPS.filter((s) => state[s.key]).length;
  const allDone = doneCount === STEPS.length;
  if (dismissed || allDone) return null;

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "true");
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }

  return (
    <section
      aria-label={t("sectionLabel")}
      className="mx-1 mb-2 rounded-lg border border-border bg-background/60 p-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("heading")}
        </p>
        <div className="flex items-center gap-1">
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {doneCount}/{STEPS.length}
          </span>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("hideAria")}
            title={t("hideTitle")}
            className="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <IconX className="size-3" />
          </button>
        </div>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={STEPS.length}
        aria-valuenow={doneCount}
        className="mt-2 h-1 overflow-hidden rounded-full bg-border"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${(doneCount / STEPS.length) * 100}%` }}
        />
      </div>

      <ul className="mt-2.5 space-y-1">
        {STEPS.map((s) => {
          const done = state[s.key];
          return (
            <li key={s.key}>
              <Link
                href={s.href}
                onClick={onNavigate}
                aria-disabled={done}
                className={cn(
                  "flex items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors",
                  done
                    ? "pointer-events-none text-muted-foreground line-through decoration-border"
                    : "hover:bg-sidebar-accent"
                )}
              >
                <span
                  className={cn(
                    "grid size-3.5 shrink-0 place-items-center rounded-full",
                    done
                      ? "bg-success/15 text-success"
                      : "border border-muted-foreground/40"
                  )}
                >
                  {done && <IconCheck className="size-2.5" />}
                </span>
                {t(s.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
