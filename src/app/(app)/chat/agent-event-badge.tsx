"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";
import { roleMeta } from "../bureau/agent-role-meta";

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
}

/**
 * Pill compacte affichée inline dans le message assistant pour visualiser
 * un agent qui démarre, finit ou échoue. À l'usage : on regroupe par
 * agentId pour passer de « (icône loader) Recherche… » à « ✓ Recherche
 * (2.1s) » au moment du finish.
 */
export function AgentEventBadge({ event }: { event: AgentEventData }) {
  const meta = roleMeta(event.role ?? "default-chat");
  const Icon = meta.icon;
  const label = event.label ?? meta.label;

  // Animation de pulsation discrète pour l'état "active" (start sans
  // finish encore reçu) — fait avec un état local plutôt qu'une classe
  // CSS pour pouvoir s'arrêter pile au finish.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (event.type !== "agent_start") return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - t0), 200);
    return () => clearInterval(id);
  }, [event.type]);

  if (event.type === "agent_start") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
        <IconLoader2 className="size-3 animate-spin" />
        <Icon className="size-3" />
        <span className="font-medium text-foreground">{label}</span>
        <span className="opacity-60">
          travaille{elapsed > 1500 ? ` · ${(elapsed / 1000).toFixed(1)}s` : "…"}
        </span>
      </span>
    );
  }

  if (event.type === "agent_finish") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
        <IconCheck className="size-3 text-emerald-600 dark:text-emerald-400" />
        <Icon className="size-3" />
        <span className="font-medium text-foreground">{label}</span>
        {typeof event.latencyMs === "number" && (
          <span className="opacity-60">
            {formatLatency(event.latencyMs)}
          </span>
        )}
        {typeof event.outputTokens === "number" && (
          <span className="opacity-60">
            · {event.outputTokens} tokens
          </span>
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
