"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  IconArrowsMaximize,
  IconCheck,
  IconLoader2,
  IconX,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { roleMeta } from "../board/agent-role-meta";
import type { AgentEventData } from "./agent-event-badge";

export interface AgentOutputData {
  pipelineRunId?: string;
  agentId?: string;
  role?: string;
  label?: string;
  output?: string;
  round?: number;
}

/**
 * Extrait du UIMessage les sorties d'agents (data-agent-output) plus la
 * sortie streamée du synthétiseur (text). Construit la timeline de
 * délibération à afficher dans la theatre view.
 */
export interface AgentTurn {
  key: string;
  agentId: string;
  role: string;
  label: string;
  round?: number;
  output: string;
  /** true pour la sortie en cours de stream (le synthétiseur final). */
  streaming: boolean;
}

export function buildAgentTurns(
  parts: { type: string; data?: unknown; text?: string }[],
  agentEvents: AgentEventData[],
  finalText: string | null,
  isStreaming: boolean
): AgentTurn[] {
  const turns: AgentTurn[] = [];

  // 1) Sorties complètes des agents intermédiaires (data-agent-output)
  for (const part of parts) {
    if (part.type !== "data-agent-output") continue;
    const d = part.data as AgentOutputData | undefined;
    if (!d?.agentId || !d.output) continue;
    turns.push({
      key: `${d.agentId}-r${d.round ?? 0}`,
      agentId: d.agentId,
      role: d.role ?? "default-chat",
      label: d.label ?? "Agent",
      round: d.round,
      output: d.output,
      streaming: false,
    });
  }

  // 2) Sortie en cours / terminée du synthétiseur final.
  // L'event agent_start du dernier agent qui n'a pas encore de finish =
  // celui qui stream. On récupère son identité dans agentEvents et son
  // contenu dans finalText.
  if (finalText) {
    const eventsByAgent = new Map<
      string,
      { hasStart: boolean; hasFinish: boolean; data: AgentEventData }
    >();
    for (const e of agentEvents) {
      if (!e.agentId) continue;
      const existing = eventsByAgent.get(e.agentId) ?? {
        hasStart: false,
        hasFinish: false,
        data: e,
      };
      if (e.type === "agent_start") existing.hasStart = true;
      if (e.type === "agent_finish") existing.hasFinish = true;
      existing.data = e;
      eventsByAgent.set(e.agentId, existing);
    }

    // Le dernier agent qui a démarré (ordre des events) — c'est le
    // synthétiseur en train de streamer.
    const lastStartedEvent = [...agentEvents]
      .reverse()
      .find((e) => e.type === "agent_start");
    if (lastStartedEvent?.agentId) {
      const turnExists = turns.some(
        (t) => t.agentId === lastStartedEvent.agentId && !t.streaming
      );
      if (!turnExists) {
        const info = eventsByAgent.get(lastStartedEvent.agentId);
        turns.push({
          key: `${lastStartedEvent.agentId}-final`,
          agentId: lastStartedEvent.agentId,
          role: lastStartedEvent.role ?? "default-chat",
          label: lastStartedEvent.label ?? "Maestro",
          output: finalText,
          streaming: isStreaming && !info?.hasFinish,
        });
      }
    }
  }

  return turns;
}

interface AgentTheatreProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineName: string;
  turns: AgentTurn[];
}

/**
 * Theatre view — vue plein écran de la délibération. Chaque tour d'agent
 * est rendu comme une carte de message premium avec son contenu en
 * markdown. Auto-scroll vers le bas à chaque nouveau tour.
 */
export function AgentTheatre({
  open,
  onOpenChange,
  pipelineName,
  turns,
}: AgentTheatreProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col"
        showCloseButton={false}
      >
        <DialogHeader className="px-6 py-4 border-b border-border flex-row items-center justify-between space-y-0 pr-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-foreground/70">
              Salle de délibération
            </p>
            <DialogTitle className="font-heading text-xl tracking-tight">
              {pipelineName}
            </DialogTitle>
          </div>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-9"
              aria-label="Fermer"
            >
              <IconX className="size-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div
          role="log"
          aria-live="polite"
          aria-atomic="false"
          aria-relevant="additions"
          className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-muted/20"
        >
          {turns.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {groupByRound(turns).map((round) => (
                <RoundBlock key={round.key} round={round} />
              ))}
              <div ref={endRef} />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 text-sm text-muted-foreground">
      <p>Le conseil n&apos;a pas encore commencé à délibérer.</p>
    </div>
  );
}

function groupByRound(turns: AgentTurn[]): {
  key: string;
  label: string | null;
  turns: AgentTurn[];
}[] {
  const groups = new Map<string, { label: string | null; turns: AgentTurn[] }>();
  for (const turn of turns) {
    const key = turn.streaming
      ? "final"
      : turn.round !== undefined
        ? `round-${turn.round}`
        : "main";
    if (!groups.has(key)) {
      groups.set(key, {
        label:
          key === "final"
            ? "Synthèse finale"
            : turn.round !== undefined
              ? `Tour ${turn.round}`
              : null,
        turns: [],
      });
    }
    groups.get(key)!.turns.push(turn);
  }
  return [...groups.entries()].map(([key, g]) => ({ key, ...g }));
}

function RoundBlock({
  round,
}: {
  round: { key: string; label: string | null; turns: AgentTurn[] };
}) {
  return (
    <div>
      {round.label && (
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
            {round.label}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}
      <div className="space-y-4">
        {round.turns.map((turn) => (
          <TurnCard key={turn.key} turn={turn} />
        ))}
      </div>
    </div>
  );
}

function TurnCard({ turn }: { turn: AgentTurn }) {
  const meta = roleMeta(turn.role);
  const Icon = meta.icon;
  const isFinal = turn.key.endsWith("-final");
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      role="article"
      aria-label={`${meta.label} : ${turn.label}${turn.round !== undefined ? ` — tour ${turn.round}` : ""}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0.2, ease: [0.23, 1, 0.32, 1] }
          : { type: "spring", damping: 26, stiffness: 220 }
      }
      className={cn(
        "rounded-2xl border bg-card overflow-hidden",
        isFinal ? "border-foreground/30 shadow-sm" : "border-border"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 border-b",
          isFinal ? "bg-foreground/5 border-foreground/15" : "bg-muted/30 border-border"
        )}
      >
        <div className="size-9 rounded-lg grid place-items-center bg-foreground/10">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-foreground/70">
            {meta.label}
          </div>
          <h3 className="font-heading text-sm tracking-tight font-medium">
            {turn.label}
          </h3>
        </div>
        {turn.streaming ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <IconLoader2 className="size-3 animate-spin" />
            en cours
          </span>
        ) : (
          <IconCheck className="size-3.5 text-success" />
        )}
      </div>

      <div className="px-5 py-4 prose prose-sm prose-neutral dark:prose-invert max-w-none prose-pre:my-2 prose-headings:font-heading prose-headings:tracking-tight prose-p:my-1.5 prose-ul:my-2 prose-li:my-0.5">
        <AnimatePresence>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {turn.output}
          </ReactMarkdown>
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

/**
 * Bouton compact qui ouvre la theatre view. À placer sur la live panel
 * pour les pipelines multi-agents.
 */
export function OpenTheatreButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-9 text-xs text-foreground/70 hover:text-foreground transition-colors px-3 rounded-md hover:bg-accent"
    >
      <IconArrowsMaximize className="size-3.5" />
      Voir le débat
    </button>
  );
}
