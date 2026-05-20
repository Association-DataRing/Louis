"use client";

import { useEffect, useState } from "react";
import {
  IconCheck,
  IconLoader2,
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
    // Collecte les attempts de retry par agent en parallèle des events.
    if (part.type === "data-agent-retry") {
      const r = part.data as AgentRetryData | undefined;
      if (!r?.agentId) continue;
      const cur = retriesByAgent.get(r.agentId) ?? 0;
      // attempt fourni = numéro de la tentative ayant échoué, donc on
      // affiche la SUIVANTE qui démarre (attempt + 1).
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

  // Injecte retryAttempt sur les agents encore en agent_start.
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
}

/**
 * Pill compacte affichée inline dans le message assistant pour visualiser
 * un agent qui démarre, finit ou échoue. Conçue pour être rendue UNE
 * fois par agent — utiliser `dedupeAgentEvents` en amont pour fusionner
 * les multiples events d'un même agent en une seule représentation.
 */
export function AgentEventBadge({ event, isLive = false }: AgentEventBadgeProps) {
  const meta = roleMeta(event.role ?? "default-chat");
  const Icon = meta.icon;
  const label = event.label ?? meta.label;

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (event.type !== "agent_start" || !isLive) return;
    const t0 = Date.now();
    // 1er tick à 200ms — pas d'init à 0 dans l'effet (lint
    // react-hooks/set-state-in-effect). Le composant a déjà 0 comme
    // valeur initiale via useState.
    const id = setInterval(() => setElapsed(Date.now() - t0), 200);
    return () => clearInterval(id);
  }, [event.type, isLive]);

  if (event.type === "agent_start") {
    // Cas live : loader anim + chrono qui tourne.
    if (isLive) {
      const inRetry = (event.retryAttempt ?? 0) > 1;
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${
            inRetry
              ? "border-foreground/30 bg-muted/60 text-foreground"
              : "border-border bg-muted/40 text-muted-foreground"
          }`}
        >
          {inRetry ? (
            <IconRefresh className="size-3 animate-spin" />
          ) : (
            <IconLoader2 className="size-3 animate-spin" />
          )}
          <Icon className="size-3" />
          <span className="font-medium text-foreground">{label}</span>
          <span className="opacity-70">
            {inRetry
              ? `retry · tentative ${event.retryAttempt}`
              : `travaille${elapsed > 1500 ? ` · ${(elapsed / 1000).toFixed(1)}s` : "…"}`}
          </span>
        </span>
      );
    }
    // Cas orphelin : un agent a démarré mais on n'a jamais reçu son
    // finish/error et le message n'est plus en cours. Probable
    // interruption (navigation, reset, erreur réseau). On signale
    // l'incomplet sans chrono pour ne pas mentir sur la durée.
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/20 px-2 py-0.5 text-[11px] text-muted-foreground">
        <IconClock className="size-3" />
        <Icon className="size-3" />
        <span className="font-medium text-foreground">{label}</span>
        <span className="opacity-60">interrompu</span>
      </span>
    );
  }

  if (event.type === "agent_finish") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
        <IconCheck className="size-3 text-success" />
        <Icon className="size-3" />
        <span className="font-medium text-foreground">{label}</span>
        {typeof event.latencyMs === "number" && (
          <span className="opacity-60">{formatLatency(event.latencyMs)}</span>
        )}
        {typeof event.outputTokens === "number" && (
          <span className="opacity-60">· {event.outputTokens} tokens</span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">
      <IconAlertTriangle className="size-3" />
      <Icon className="size-3" />
      <span className="font-medium">{label}</span>
      {event.error && (
        <span className="opacity-80 truncate max-w-[200px]">· {event.error}</span>
      )}
    </span>
  );
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
