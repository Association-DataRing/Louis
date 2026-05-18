"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Pipeline, PipelineAgent, ProviderKey } from "@/db/schema";
import { AgentEditSheet } from "../agent-edit-sheet";
import { AgentFlowNode, type AgentFlowNodeData } from "./agent-flow-node";
import { removeAgentFromPipeline } from "../actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface PipelineWorkflowProps {
  pipeline: Pipeline;
  agents: PipelineAgent[];
  providerKeys: Pick<ProviderKey, "id" | "label" | "type">[];
  liveStates?: Record<string, "idle" | "active" | "done" | "error">;
}

const nodeTypes: NodeTypes = {
  agent: AgentFlowNode,
};

const NODE_WIDTH = 280;
const NODE_GAP_X = 80;
const NODE_HEIGHT = 200;
const NODE_GAP_Y = 100;

/**
 * Calcule les positions de chaque node selon le mode :
 * - sequential : grille horizontale (gauche → droite)
 * - council    : synthétiseur centré en bas, débateurs en arc au-dessus
 * - parallel   : synthétiseur en bas, workers étalés au-dessus
 */
function layoutNodes(
  agents: PipelineAgent[],
  mode: "sequential" | "council" | "parallel"
): Array<{ x: number; y: number }> {
  if (agents.length === 0) return [];

  if (mode === "sequential") {
    return agents.map((_, i) => ({
      x: i * (NODE_WIDTH + NODE_GAP_X),
      y: 0,
    }));
  }

  // council & parallel : workers/débateurs en ligne en haut, synth en bas
  const synthIndex = agents.length - 1;
  const workers = agents.slice(0, -1);
  const totalWidth = workers.length * (NODE_WIDTH + NODE_GAP_X) - NODE_GAP_X;
  const synthX = totalWidth / 2 - NODE_WIDTH / 2;

  return agents.map((_, i) => {
    if (i === synthIndex) {
      return { x: synthX, y: NODE_HEIGHT + NODE_GAP_Y };
    }
    return {
      x: i * (NODE_WIDTH + NODE_GAP_X),
      y: 0,
    };
  });
}

/**
 * Construit les edges selon le mode :
 * - sequential : chaîne A → B → C
 * - council & parallel : chaque worker pointe vers le synthétiseur ; en
 *   council on ajoute des edges de débat (workers ↔ workers) en pointillés
 */
function buildEdges(
  agents: PipelineAgent[],
  mode: "sequential" | "council" | "parallel",
  liveStates: Record<string, string> | undefined
): Edge[] {
  if (agents.length < 2) return [];

  if (mode === "sequential") {
    return agents.slice(0, -1).map((a, i) => {
      const next = agents[i + 1];
      const active =
        liveStates?.[a.id] === "done" && liveStates?.[next.id] !== "idle";
      return {
        id: `${a.id}->${next.id}`,
        source: a.id,
        target: next.id,
        type: "smoothstep",
        animated: active || !liveStates,
        style: {
          stroke: "var(--color-foreground)",
          strokeOpacity: 0.4,
          strokeWidth: 1.5,
        },
      };
    });
  }

  // council & parallel : workers → synthétiseur
  const synth = agents[agents.length - 1];
  const workers = agents.slice(0, -1);
  const edges: Edge[] = workers.map((w) => {
    const active = liveStates?.[w.id] === "done";
    return {
      id: `${w.id}->${synth.id}`,
      source: w.id,
      target: synth.id,
      type: "smoothstep",
      animated: active || !liveStates,
      style: {
        stroke: "var(--color-foreground)",
        strokeOpacity: 0.4,
        strokeWidth: 1.5,
      },
    };
  });

  // En council, on rajoute des edges de débat entre workers (en pointillés)
  if (mode === "council" && workers.length > 1) {
    for (let i = 0; i < workers.length - 1; i++) {
      const a = workers[i];
      const b = workers[i + 1];
      edges.push({
        id: `${a.id}<->${b.id}`,
        source: a.id,
        target: b.id,
        type: "straight",
        animated: false,
        style: {
          stroke: "var(--color-foreground)",
          strokeOpacity: 0.25,
          strokeWidth: 1,
          strokeDasharray: "4 4",
        },
        sourceHandle: undefined,
        targetHandle: undefined,
      });
    }
  }

  return edges;
}

function PipelineWorkflowInner({
  pipeline,
  agents,
  providerKeys,
  liveStates,
}: PipelineWorkflowProps) {
  const router = useRouter();
  const [editingAgent, setEditingAgent] = useState<PipelineAgent | null>(null);
  const [pending, startTransition] = useTransition();
  const editable = !pipeline.isPreset && !pending;
  const mode = (pipeline.mode as "sequential" | "council" | "parallel") ?? "sequential";

  const handleDelete = useCallback(
    (agent: PipelineAgent) => {
      if (
        !confirm(
          `Supprimer l'agent « ${agent.label} » de cette pipeline ?`
        )
      )
        return;
      startTransition(async () => {
        const result = await removeAgentFromPipeline(agent.id);
        router.refresh();
        if (result.ok) {
          toast.success("Agent retiré", {
            description: `${agent.label} a été retiré de la pipeline.`,
          });
        } else {
          toast.error("Suppression impossible", {
            description: result.error,
          });
        }
      });
    },
    [router]
  );

  const positions = useMemo(() => layoutNodes(agents, mode), [agents, mode]);

  const initialNodes: Node[] = useMemo(
    () =>
      agents.map((agent, i) => {
        const data: AgentFlowNodeData = {
          agent,
          providerKeys,
          position: i,
          isFinal: i === agents.length - 1,
          state: liveStates?.[agent.id] ?? "idle",
          editable,
          onEdit: editable ? () => setEditingAgent(agent) : undefined,
          onDelete:
            editable && agents.length > 1
              ? () => handleDelete(agent)
              : undefined,
        };
        return {
          id: agent.id,
          type: "agent",
          position: positions[i],
          data,
          draggable: false,
        };
      }),
    [agents, providerKeys, liveStates, editable, handleDelete, positions]
  );

  const initialEdges = useMemo(
    () => buildEdges(agents, mode, liveStates),
    [agents, mode, liveStates]
  );

  const fitViewOptions = useMemo(
    () => ({ padding: 0.2, duration: 600 }),
    []
  );
  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  const onNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      if (!editable) return;
      const agent = agents.find((a) => a.id === node.id);
      if (agent) setEditingAgent(agent);
    },
    [agents, editable]
  );

  // Hauteur dynamique : sequential = 1 ligne, council/parallel = 2 lignes
  const canvasHeight =
    mode === "sequential"
      ? Math.max(NODE_HEIGHT + 120, 320)
      : Math.max(NODE_HEIGHT * 2 + NODE_GAP_Y + 120, 480);

  return (
    <>
      <div
        className="w-full rounded-2xl border border-border bg-muted/10 overflow-hidden"
        style={{ height: canvasHeight }}
      >
        <ReactFlow
          nodes={initialNodes}
          edges={initialEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={fitViewOptions}
          proOptions={proOptions}
          minZoom={0.4}
          maxZoom={1.5}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          onNodeClick={onNodeClick}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--color-border)"
          />
          <Controls
            position="bottom-right"
            showInteractive={false}
            className="!bg-card !border !border-border !shadow-sm"
          />
          {agents.length > 3 && (
            <MiniMap
              pannable
              zoomable
              className="!bg-card !border !border-border"
              maskColor="rgb(0 0 0 / 0.05)"
              nodeColor="var(--color-foreground)"
            />
          )}
        </ReactFlow>
      </div>

      {editingAgent && (
        <AgentEditSheet
          agent={editingAgent}
          providerKeys={providerKeys}
          open={!!editingAgent}
          onOpenChange={(open) => {
            if (!open) setEditingAgent(null);
          }}
        />
      )}
    </>
  );
}

export function PipelineWorkflow(props: PipelineWorkflowProps) {
  return (
    <ReactFlowProvider>
      <PipelineWorkflowInner {...props} />
    </ReactFlowProvider>
  );
}
