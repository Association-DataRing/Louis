"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  IconCheck,
  IconAlertTriangle,
  IconClock,
  IconRefresh,
} from "@tabler/icons-react";
import { roleMeta } from "../board/agent-role-meta";

/**
 * Forme du payload d'un event orchestrateur tel qu'il transite via
 * `data-agent-event` dans le UI message stream. Volontairement souple :
 * c'est un canal de visualisation, pas un contrat strict.
 */
export interface AgentEventData {
  type: "agent_start" | "agent_finish" | "agent_error";
  pipelineRunId?: string;
  agentId?: string;
  role?: string;
  label?: string;
  position?: number;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  preview?: string;
  error?: string;
  /** Numéro de tour (mode council multi-tours). undefined sinon. */
  round?: number;
  /**
   * Numéro de la tentative en cours (1 = première, 2 = premier retry…).
   * Injecté côté chat-shell quand un `data-agent-retry` est reçu pour
   * cet agent et qu'il est toujours en état `agent_start`.
   */
  retryAttempt?: number;
}

/**
 * Payload du canal data-agent-retry — émis quand l'orchestrateur
 * intercepte une erreur transitoire et déclenche un retry exponentiel.
 */
export interface AgentRetryData {
  pipelineRunId?: string;
  agentId?: string;
  role?: string;
  label?: string;
  attempt: number;
  delayMs: number;
  round?: number;
}

/**
 * Priorité de fusion entre events d'un même agent. Si on a reçu plusieurs
 * events, on garde l'état le plus avancé (start < finish < error).
 */
const STATE_ORDER: Record<AgentEventData["type"], number> = {
  agent_start: 0,
  agent_finish: 1,
  agent_error: 2,
};

/**
 * À partir des parts brutes d'un message assistant, retourne la liste
 * dédupliquée des events d'agents (un seul par agentId, l'event le plus
 * avancé en priorité). Préserve l'ordre de première apparition pour que
 * les badges suivent la séquence d'exécution.
 */
export function dedupeAgentEvents(
  parts: { type: string; data?: unknown }[]
): AgentEventData[] {
  const map = new Map<string, AgentEventData>();
  const order: string[] = [];
  const retriesByAgent = new Map<string, number>();

  for (const part of parts) {
    if (part.type === "data-agent-retry") {
      const r = part.data as AgentRetryData | undefined;
      if (!r?.agentId) continue;
      const cur = retriesByAgent.get(r.agentId) ?? 0;
      if (r.attempt + 1 > cur) {
        retriesByAgent.set(r.agentId, r.attempt + 1);
      }
      continue;
    }
    if (part.type !== "data-agent-event") continue;
    const data = part.data as AgentEventData | undefined;
    if (!data?.agentId) continue;
    const existing = map.get(data.agentId);
    if (!existing) {
      map.set(data.agentId, data);
      order.push(data.agentId);
    } else if (STATE_ORDER[data.type] >= STATE_ORDER[existing.type]) {
      map.set(data.agentId, data);
    }
  }

  return order.map((id) => {
    const evt = map.get(id)!;
    const attempt = retriesByAgent.get(id);
    if (attempt && evt.type === "agent_start") {
      return { ...evt, retryAttempt: attempt };
    }
    return evt;
  });
}

interface AgentEventBadgeProps {
  event: AgentEventData;
  /**
   * Indique si l'agent est encore potentiellement actif (message en cours
   * de streaming). Quand `false`, on n'anime plus le chrono — empêche les
   * badges « travaille · 7997s » sur d'anciens messages dont la pipeline
   * a été interrompue et qui n'ont jamais reçu de finish.
   */
  isLive?: boolean;
  /**
   * Affiche un trait vertical reliant ce step au suivant. Le dernier step
   * d'une séquence passe `false`. Crée la sensation timeline continue.
   */
  showConnector?: boolean;
}

/**
 * Step rendu dans la timeline d'une `AgentStepsWrapper`. Format chronologique
 * vertical : bullet 6px (spinner en cours / vert terminé / rouge erreur) +
 * label + connecteur vertical optionnel vers le step suivant.
 *
 * Utiliser `dedupeAgentEvents` en amont pour fusionner les multiples events
 * d'un même agent en une seule représentation.
 */
export function AgentEventBadge({
  event,
  isLive = false,
  showConnector = false,
}: AgentEventBadgeProps) {
  const t = useTranslations("chat");
  const tBoard = useTranslations("board");
  const meta = roleMeta(event.role ?? "default-chat");
  const Icon = meta.icon;
  const label = event.label ?? tBoard(meta.labelKey);

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (event.type !== "agent_start" || !isLive) return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - t0), 200);
    return () => clearInterval(id);
  }, [event.type, isLive]);

  // Bullet : spinner border-t-transparent quand en cours, plein sinon.
  const bullet = (() => {
    if (event.type === "agent_start" && isLive) {
      return (
        <span className="mt-[5px] size-1.5 shrink-0 rounded-full border border-muted-foreground/70 border-t-transparent animate-spin" />
      );
    }
    if (event.type === "agent_finish") {
      return (
        <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-success" />
      );
    }
    if (event.type === "agent_error") {
      return (
        <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-destructive" />
      );
    }
    // agent_start orphelin (non-live)
    return (
      <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
    );
  })();

  // Verbe : présent pendant le streaming, passé une fois terminé.
  // L'asymétrie verbale crée la sensation de progression dans la timeline.
  const verb = (() => {
    if (event.type === "agent_start") {
      if (!isLive) return t("agentSteps.interrupted");
      const inRetry = (event.retryAttempt ?? 0) > 1;
      if (inRetry) return t("agentSteps.retrying", { attempt: event.retryAttempt ?? 0 });
      return t("agentSteps.verbWorking");
    }
    if (event.type === "agent_finish") return t("agentSteps.verbDone");
    return t("agentSteps.verbFailed");
  })();

  const isError = event.type === "agent_error";

  return (
    <div className="relative flex items-start text-sm">
      {/* Connecteur vertical entre le bullet et celui du step suivant. */}
      {showConnector && (
        <span
          aria-hidden
          className="absolute left-[2.5px] top-[15px] bottom-0 w-px bg-border h-[calc(100%+0.75rem)]"
        />
      )}

      {bullet}

      <div className="ml-2.5 min-w-0 flex-1 flex items-center gap-1.5 flex-wrap text-muted-foreground">
        <Icon className="size-3 shrink-0 opacity-60" />
        <span
          className={`font-medium ${isError ? "text-destructive" : "text-foreground"}`}
        >
          {label}
        </span>
        <span className="opacity-70">·</span>
        <span className={isError ? "text-destructive/80" : "opacity-80"}>
          {verb}
          {event.type === "agent_start" && isLive && elapsed > 1500 && (
            <span className="opacity-70">
              {" "}
              · {(elapsed / 1000).toFixed(1)}s
            </span>
          )}
          {event.type === "agent_finish" &&
            typeof event.latencyMs === "number" && (
              <span className="opacity-70">
                {" "}
                · {formatLatency(event.latencyMs)}
              </span>
            )}
          {event.type === "agent_finish" &&
            typeof event.outputTokens === "number" && (
              <span className="opacity-60">
                {" "}
                · {event.outputTokens} tokens
              </span>
            )}
          {isError && event.error && (
            <span className="opacity-80 truncate max-w-[240px]">
              {" "}
              · {event.error}
            </span>
          )}
        </span>
        {/* Indicateur retry isolé (badge clock) pour les orphelins */}
        {event.type === "agent_start" && !isLive && (
          <IconClock className="size-3 opacity-60 shrink-0" />
        )}
        {event.type === "agent_start" &&
          isLive &&
          (event.retryAttempt ?? 0) > 1 && (
            <IconRefresh className="size-3 animate-spin opacity-70 shrink-0" />
          )}
        {event.type === "agent_finish" && (
          <IconCheck className="size-3 text-success/80 shrink-0" />
        )}
        {isError && (
          <IconAlertTriangle className="size-3 text-destructive shrink-0" />
        )}
      </div>
    </div>
  );
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
