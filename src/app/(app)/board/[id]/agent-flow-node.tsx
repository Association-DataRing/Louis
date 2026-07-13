"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  IconAlertTriangle,
  IconCheck,
  IconDatabase,
  IconDatabaseOff,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { PipelineAgent, ProviderKey } from "@/db/schema";
import { roleMeta } from "../agent-role-meta";

/**
 * Libellé de transparence de la portée RAG d'un agent. `null` pour le cas par
 * défaut (hérite du périmètre de la conversation) afin de ne pas alourdir le
 * canvas — on ne signale QUE les agents à portée restreinte.
 */
function ragScopeBadge(
  scope: PipelineAgent["ragScope"],
  t: ReturnType<typeof useTranslations>
): { label: string; off: boolean } | null {
  if (!scope || scope.mode === "inherit" || scope.mode === "project") {
    return null;
  }
  if (scope.mode === "none")
    return { label: t("flowNode.ragDisabled"), off: true };
  if (scope.mode === "folders") {
    const n = scope.folderIds.length;
    return { label: t("flowNode.ragFolders", { count: n }), off: false };
  }
  const n = scope.documentIds.length;
  return { label: t("flowNode.ragDocs", { count: n }), off: false };
}

/**
 * Données portées par chaque node React Flow. Le composant lit la
 * définition d'agent + un setter de drawer pour ouvrir l'édition au clic.
 */
export interface AgentFlowNodeData {
  agent: PipelineAgent;
  providerKeys: Pick<ProviderKey, "id" | "label" | "type">[];
  position: number;
  isFinal: boolean;
  state: "idle" | "active" | "done" | "error";
  editable: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  [key: string]: unknown;
}

function AgentFlowNodeBase({ data }: NodeProps) {
  const t = useTranslations("board");
  const {
    agent,
    providerKeys,
    position,
    isFinal,
    state,
    editable,
    onEdit,
    onDelete,
  } = data as AgentFlowNodeData;
  const meta = roleMeta(agent.role);
  const Icon = meta.icon;
  const provider = providerKeys.find((k) => k.id === agent.providerKeyId);
  const rag = ragScopeBadge(agent.ragScope, t);

  return (
    <div
      className={cn(
        "relative w-[280px] rounded-xl border overflow-hidden shadow-sm transition-all",
        meta.tintBg,
        isFinal ? "border-foreground/40" : "border-border",
        state === "active" &&
          "ring-2 ring-foreground/40 ring-offset-2 ring-offset-background",
        state === "done" && "border-foreground/50",
        state === "error" && "border-destructive/60 bg-destructive/5"
      )}
    >
      {state === "active" && (
        <span
          className="absolute top-2 right-2 z-10 flex size-2"
          aria-label={t("flowNode.agentActive")}
        >
          <span className="absolute inline-flex size-full motion-safe:animate-pulse rounded-full bg-foreground/30 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-foreground/80" />
        </span>
      )}
      {state === "done" && (
        <span
          className="absolute top-2 right-2 z-10 inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-success"
          aria-label={t("flowNode.agentDone")}
        >
          <IconCheck className="size-3.5" />
          {t("flowNode.done")}
        </span>
      )}
      {state === "error" && (
        <span
          className="absolute top-2 right-2 z-10 inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-destructive"
          aria-label={t("flowNode.agentError")}
        >
          <IconAlertTriangle className="size-3.5" />
          {t("flowNode.error")}
        </span>
      )}
      {/* Handle conservé pour l'ANCRAGE des edges auto-générées, mais invisible
          et non-interactif : le graphe n'est pas un éditeur de connexions
          (nodesConnectable=false). Avant, des poignées visibles laissaient
          croire qu'on pouvait relier les agents à la main (H7). */}
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!size-2 !border-0 !bg-transparent !opacity-0 !pointer-events-none"
      />

      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 border-b",
          isFinal
            ? "bg-foreground/5 border-foreground/15"
            : cn(meta.tintAccent, "border-border")
        )}
      >
        <div className="size-7 rounded-md grid place-items-center bg-foreground/10">
          <Icon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-foreground/70">
            {t("flowNode.step", { n: position + 1 })}{" "}
            {isFinal && t("flowNode.terminalSuffix")}
          </div>
          <h3 className="font-heading text-sm tracking-tight truncate font-medium">
            {agent.label}
          </h3>
        </div>
        {editable && (
          <div className="flex items-center gap-0.5">
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="size-9 grid place-items-center rounded-md hover:bg-accent transition-colors"
                aria-label={t("flowNode.edit", { label: agent.label })}
              >
                <IconPencil className="size-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="size-9 grid place-items-center rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
                aria-label={t("flowNode.delete", { label: agent.label })}
              >
                <IconTrash className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-3 space-y-2">
        <div className="text-[11px] text-muted-foreground">{t(meta.pitchKey)}</div>

        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {agent.modelOverride ? (
            <span className="inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5 font-mono text-foreground">
              {agent.modelOverride}
            </span>
          ) : (
            <span className="inline-flex items-center rounded border border-dashed border-border bg-background px-1.5 py-0.5 text-muted-foreground italic">
              {t("flowNode.defaultModel")}
            </span>
          )}
          {provider && (
            <span className="inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5 text-muted-foreground">
              {provider.label}
            </span>
          )}
          {rag && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded border px-1.5 py-0.5",
                rag.off
                  ? "border-dashed border-border bg-background text-muted-foreground"
                  : "border-border bg-background text-foreground"
              )}
            >
              {rag.off ? (
                <IconDatabaseOff className="size-3" />
              ) : (
                <IconDatabase className="size-3" />
              )}
              {rag.label}
            </span>
          )}
        </div>

        {agent.systemPrompt && (
          <div className="text-[11px] text-muted-foreground line-clamp-2 italic border-l-2 border-border/60 pl-2">
            {agent.systemPrompt.slice(0, 120)}
            {agent.systemPrompt.length > 120 && "…"}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-mono uppercase tracking-wider">{t(meta.labelKey)}</span>
        {agent.toolAllowlist === null || agent.toolAllowlist === undefined ? (
          <span>{t("flowNode.allTools")}</span>
        ) : agent.toolAllowlist.length === 0 ? (
          <span>{t("flowNode.noTools")}</span>
        ) : (
          <span>
            {t("flowNode.toolsCount", { count: agent.toolAllowlist.length })}
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!size-2 !border-0 !bg-transparent !opacity-0 !pointer-events-none"
      />
    </div>
  );
}

export const AgentFlowNode = memo(AgentFlowNodeBase);
