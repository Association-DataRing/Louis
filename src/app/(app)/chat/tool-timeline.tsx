"use client";

import { useState, type ReactNode } from "react";
import {
  IconSparkles,
  IconChevronDown,
  IconCircleCheck,
  IconCopy,
  IconCheck,
  IconLoader2,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { toolMeta, summarizeTools } from "./tool-meta";

export interface ToolTimelineRow {
  id: string;
  name: string;
  label: string;
  summary?: string;
  pending: boolean;
  autoExpand: boolean;
  input?: unknown;
  output?: unknown;
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

/**
 * Timeline consolidée des actions du modèle pour un tour : un en-tête
 * récapitulatif repliable (compteurs + durée), une ligne par outil (icône,
 * libellé, chip de catégorie), dépliable pour révéler le détail (carte riche
 * ou JSON), et un terminateur « Terminé ». Inspirée des vues d'activité d'agent.
 */
export function ToolTimeline({
  rows,
  durationMs,
  isStreaming,
  renderDetail,
}: {
  rows: ToolTimelineRow[];
  durationMs?: number;
  isStreaming: boolean;
  renderDetail: (row: ToolTimelineRow) => ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(rows.filter((r) => r.autoExpand).map((r) => r.id))
  );

  if (rows.length === 0) return null;

  const summary = summarizeTools(rows.map((r) => r.name));

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="w-full">
      {/* En-tête récapitulatif */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="group/h w-full flex items-center gap-2.5 py-1.5 text-left"
      >
        <IconSparkles className="size-4 shrink-0 text-foreground/60" />
        <span className="text-[15px] font-medium truncate">{summary}</span>
        <IconChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground/60 group-hover/h:text-muted-foreground transition-transform",
            collapsed && "-rotate-90"
          )}
        />
        <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
          {isStreaming ? (
            <IconLoader2 className="size-3.5 animate-spin" />
          ) : durationMs && durationMs > 0 ? (
            formatDuration(durationMs)
          ) : null}
        </span>
      </button>

      {!collapsed && (
        <div className="relative">
          {/* Ligne verticale de la timeline */}
          <div
            className="absolute left-[0.875rem] top-1 bottom-4 w-px bg-border/70"
            aria-hidden
          />
          <ul className="relative flex flex-col">
            {rows.map((row) => {
              const meta = toolMeta(row.name);
              const Icon = meta.icon;
              const isOpen = expanded.has(row.id);
              return (
                <li key={row.id} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => toggleRow(row.id)}
                    aria-expanded={isOpen}
                    className="group flex items-center gap-3 py-2 text-left w-full"
                  >
                    <span className="relative z-10 grid place-items-center size-7 rounded-full border border-border/70 bg-background text-foreground/55">
                      {row.pending ? (
                        <IconLoader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Icon className="size-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] truncate">
                      <span className="text-foreground/90 group-hover:text-foreground transition-colors">
                        {row.label}
                      </span>
                      {row.summary && (
                        <span className="text-muted-foreground/80"> · {row.summary}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground rounded-md bg-muted/60 px-2 py-0.5">
                      {meta.chip}
                    </span>
                  </button>
                  {isOpen && !row.pending && (
                    <div className="ml-10 mb-2 mt-0.5">{renderDetail(row)}</div>
                  )}
                </li>
              );
            })}

            {!isStreaming && (
              <li className="flex items-center gap-3 py-2">
                <span className="relative z-10 grid place-items-center size-7 rounded-full border border-border/70 bg-background text-success/80">
                  <IconCircleCheck className="size-4" />
                </span>
                <span className="text-[15px] text-muted-foreground">Terminé</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Détail JSON repliable d'une action (entrée + sortie de l'outil), avec un
 * bouton de copie — pour les outils sans rendu riche dédié.
 */
export function JsonDetail({
  input,
  output,
}: {
  input?: unknown;
  output?: unknown;
}) {
  const [copied, setCopied] = useState(false);
  const payload = JSON.stringify(
    { input: input ?? null, output: output ?? null },
    null,
    2
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponible (http non sécurisé) — silencieux
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          JSON
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copier le JSON"
          className="inline-flex items-center justify-center size-6 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {copied ? (
            <IconCheck className="size-3.5 text-success" />
          ) : (
            <IconCopy className="size-3.5" />
          )}
        </button>
      </div>
      <pre className="px-3 py-2 text-xs font-mono leading-relaxed overflow-x-auto max-h-72">
        {payload}
      </pre>
    </div>
  );
}
