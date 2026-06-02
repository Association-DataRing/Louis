"use client";

import { useState } from "react";
import type { Pipeline, PipelineAgent, ProviderKey } from "@/db/schema";
import type {
  AgentSourceFolder,
  AgentSourceDocument,
} from "@/lib/projects/scope";
import { AgentCard } from "./agent-card";
import { AgentEditSheet, type AgentEditModelOption } from "./agent-edit-sheet";

interface PipelineBoardProps {
  pipeline: Pipeline;
  agents: PipelineAgent[];
  providerKeys: Pick<ProviderKey, "id" | "label" | "type">[];
  enabledModels?: AgentEditModelOption[];
  availableTools?: string[];
  availableFolders?: AgentSourceFolder[];
  availableDocuments?: AgentSourceDocument[];
}

/**
 * Affichage vertical d'une pipeline — fallback mobile (H7) du canvas React
 * Flow, inutilisable sur petit écran. L'agent terminal (dernier de la
 * séquence) est mis en avant en haut — c'est celui dont la réponse arrive à
 * l'utilisateur ; les agents intermédiaires sont empilés en dessous dans
 * leur ordre d'exécution.
 *
 * Pour les pipelines mono-agent (chat-simple), on affiche juste la seule
 * carte — pas de hiérarchie artificielle.
 */
export function PipelineBoard({
  pipeline,
  agents,
  providerKeys,
  enabledModels,
  availableTools,
  availableFolders,
  availableDocuments,
}: PipelineBoardProps) {
  const [editingAgent, setEditingAgent] = useState<PipelineAgent | null>(null);

  if (agents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Cette pipeline n&apos;a aucun agent configuré.
      </div>
    );
  }

  // Le dernier agent est le « manager » (le seul dont la réponse est
  // streamée à l'utilisateur). Les autres sont les « collaborateurs ».
  const manager = agents[agents.length - 1];
  const team = agents.slice(0, -1);
  const isMonoAgent = team.length === 0;

  const editable = !pipeline.isPreset;

  return (
    <div className="space-y-6">
      <div
        className={`grid gap-4 ${isMonoAgent ? "" : "place-items-center"}`}
      >
        <div className={isMonoAgent ? "w-full" : "w-full max-w-sm"}>
          <AgentCard
            agent={manager}
            emphasis
            editable={editable}
            onEdit={() => setEditingAgent(manager)}
            modelLabel={manager.modelOverride}
            providerLabel={providerLabelFor(manager.providerKeyId, providerKeys)}
          />
        </div>

        {!isMonoAgent && (
          <>
            <div
              className="w-px h-6 bg-border"
              role="presentation"
              aria-hidden
            />
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              s&apos;appuie sur
            </div>
            <div className="grid grid-cols-1 gap-4 w-full">
              {team.map((a, i) => (
                <div key={a.id} className="relative">
                  <span className="absolute -top-3 left-3 text-[11px] uppercase tracking-wider bg-background px-1 text-muted-foreground">
                    Étape {i + 1}
                  </span>
                  <AgentCard
                    agent={a}
                    editable={editable}
                    onEdit={() => setEditingAgent(a)}
                    modelLabel={a.modelOverride}
                    providerLabel={providerLabelFor(a.providerKeyId, providerKeys)}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {editingAgent && (
        <AgentEditSheet
          agent={editingAgent}
          providerKeys={providerKeys}
          enabledModels={enabledModels}
          availableTools={availableTools}
          availableFolders={availableFolders}
          availableDocuments={availableDocuments}
          open={!!editingAgent}
          onOpenChange={(open) => {
            if (!open) setEditingAgent(null);
          }}
        />
      )}
    </div>
  );
}

function providerLabelFor(
  providerKeyId: string | null,
  keys: Pick<ProviderKey, "id" | "label" | "type">[]
): string | null {
  if (!providerKeyId) return null;
  const k = keys.find((x) => x.id === providerKeyId);
  return k ? `${k.label}` : null;
}
