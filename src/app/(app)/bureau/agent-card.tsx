"use client";

import { cn } from "@/lib/utils";
import { IconPencil } from "@tabler/icons-react";
import type { PipelineAgent } from "@/db/schema";
import { roleMeta } from "./agent-role-meta";

interface AgentCardProps {
  agent: PipelineAgent;
  /** Met l'agent au format « manager » avec un fond légèrement plus marqué. */
  emphasis?: boolean;
  /** Affiche le bouton crayon — désactivé si la pipeline est un preset système. */
  editable?: boolean;
  onEdit?: () => void;
  /** État live durant l'exécution (allume un halo). */
  state?: "idle" | "active" | "done" | "error";
  /** Métadonnées d'overlay : nom du modèle effectif, provider… */
  modelLabel?: string | null;
  providerLabel?: string | null;
}

export function AgentCard({
  agent,
  emphasis,
  editable,
  onEdit,
  state = "idle",
  modelLabel,
  providerLabel,
}: AgentCardProps) {
  const meta = roleMeta(agent.role);
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card px-4 py-3.5 transition-colors",
        emphasis ? "border-foreground/30 bg-foreground/5" : "border-border",
        state === "active" &&
          "ring-2 ring-foreground/30 ring-offset-2 ring-offset-background",
        state === "done" && "border-foreground/40",
        state === "error" && "border-destructive/60 bg-destructive/5"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "size-9 shrink-0 rounded-md grid place-items-center",
            emphasis ? "bg-foreground/10" : "bg-foreground/5"
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-heading text-sm tracking-tight">
              {agent.label}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {meta.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
            {meta.pitch}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {modelLabel && (
              <span className="inline-flex items-center rounded border border-border/60 bg-background px-1.5 py-0.5 font-mono">
                {modelLabel}
              </span>
            )}
            {providerLabel && (
              <span className="inline-flex items-center rounded border border-border/60 bg-background px-1.5 py-0.5">
                {providerLabel}
              </span>
            )}
            {agent.toolAllowlist !== null && agent.toolAllowlist !== undefined && (
              <span
                className="inline-flex items-center rounded border border-border/60 bg-background px-1.5 py-0.5"
                title={
                  agent.toolAllowlist.length === 0
                    ? "Aucun outil autorisé"
                    : agent.toolAllowlist.join(", ")
                }
              >
                {agent.toolAllowlist.length === 0
                  ? "0 outil"
                  : `${agent.toolAllowlist.length} outil${agent.toolAllowlist.length > 1 ? "s" : ""}`}
              </span>
            )}
          </div>
        </div>
        {editable && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity size-8 grid place-items-center rounded-md hover:bg-accent"
            aria-label={`Modifier ${agent.label}`}
          >
            <IconPencil className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
