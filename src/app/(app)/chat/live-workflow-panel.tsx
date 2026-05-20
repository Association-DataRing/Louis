"use client";

import { AnimatePresence, motion } from "motion/react";
import { IconBriefcase, IconLoader2, IconCheck, IconAlertTriangle, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { roleMeta } from "../bureau/agent-role-meta";
import { OpenTheatreButton } from "./agent-theatre";

export interface LiveAgentState {
  id: string;
  role: string;
  label: string;
  state: "idle" | "active" | "done" | "error";
  latencyMs?: number;
  error?: string;
}

interface LiveWorkflowPanelProps {
  open: boolean;
  pipelineName: string;
  agents: LiveAgentState[];
  onClose?: () => void;
  onOpenTheatre?: () => void;
}

const verbByRole: Record<string, string> = {
  orchestrator: "synthétise",
  research: "cherche",
  citator: "vérifie les citations",
  reviewer: "relit",
  drafting: "rédige",
  legifrance: "consulte Légifrance",
  "default-chat": "réfléchit",
};

/**
 * Panneau flottant qui s'affiche au-dessus du composer pendant l'exécution
 * d'une pipeline. Chaque agent est représenté comme une carte qui s'allume
 * en séquence — verbe d'action contextualisé selon le rôle (« Recherche
 * cherche… », « Citateur vérifie… ») pour ne plus laisser l'utilisateur
 * dans le flou pendant les ~30s d'un run multi-agents.
 */
export function LiveWorkflowPanel({
  open,
  pipelineName,
  agents,
  onClose,
  onOpenTheatre,
}: LiveWorkflowPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ type: "spring", damping: 24, stiffness: 280 }}
          role="status"
          aria-live="polite"
          aria-atomic="false"
          className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-border bg-card/95 backdrop-blur shadow-lg overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
            <div className="size-7 rounded-md grid place-items-center bg-foreground/10">
              <IconBriefcase className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Board en action
              </div>
              <div className="text-sm font-medium truncate">{pipelineName}</div>
            </div>
            {onOpenTheatre && (
              <OpenTheatreButton onClick={onOpenTheatre} />
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="size-9 grid place-items-center rounded-md hover:bg-accent transition-colors"
                aria-label="Fermer"
              >
                <IconX className="size-4" />
              </button>
            )}
          </div>

          <div className="px-4 py-4 flex items-stretch gap-2 overflow-x-auto">
            {agents.map((agent, i) => (
              <div key={agent.id} className="flex items-stretch gap-2 shrink-0">
                <AgentStep agent={agent} />
                {i < agents.length - 1 && (
                  <Connector
                    active={
                      agent.state === "done" &&
                      agents[i + 1].state !== "idle"
                    }
                  />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AgentStep({ agent }: { agent: LiveAgentState }) {
  const meta = roleMeta(agent.role);
  const Icon = meta.icon;
  const verb = verbByRole[agent.role] ?? "travaille";

  return (
    <motion.div
      layout
      className={cn(
        "w-[180px] rounded-xl border bg-background px-3 py-2.5 transition-colors",
        agent.state === "idle" && "border-border/60 opacity-50",
        agent.state === "active" &&
          "border-foreground/40 bg-foreground/5 shadow-sm",
        agent.state === "done" && "border-foreground/30",
        agent.state === "error" && "border-destructive/60 bg-destructive/5"
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "size-7 rounded-md grid place-items-center",
            agent.state === "active"
              ? "bg-foreground/10"
              : "bg-muted"
          )}
        >
          <Icon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {meta.label}
          </div>
          <div className="text-xs font-medium truncate">{agent.label}</div>
        </div>
        <StateIndicator state={agent.state} />
      </div>

      <AnimatePresence mode="wait">
        {agent.state === "active" && (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="mt-2 text-xs text-muted-foreground overflow-hidden"
          >
            <span className="inline-flex items-center gap-1">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground/40 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-foreground/80" />
              </span>
              {verb}…
            </span>
          </motion.div>
        )}
        {agent.state === "done" && typeof agent.latencyMs === "number" && (
          <motion.div
            key="done"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-xs text-muted-foreground"
          >
            terminé en {formatLatency(agent.latencyMs)}
          </motion.div>
        )}
        {agent.state === "error" && agent.error && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-[11px] text-destructive line-clamp-2"
          >
            {agent.error}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StateIndicator({ state }: { state: LiveAgentState["state"] }) {
  if (state === "active") {
    return <IconLoader2 className="size-3.5 animate-spin text-foreground/70 shrink-0" />;
  }
  if (state === "done") {
    return <IconCheck className="size-3.5 text-success shrink-0" />;
  }
  if (state === "error") {
    return <IconAlertTriangle className="size-3.5 text-destructive shrink-0" />;
  }
  return null;
}

function Connector({ active }: { active: boolean }) {
  return (
    <div className="self-center w-6 h-px relative">
      <div className="absolute inset-0 bg-border" />
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0 bg-foreground/60"
            style={{ transformOrigin: "left" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
