"use client";

import { useCallback, useMemo, useState } from "react";
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

interface PipelineWorkflowProps {
  pipeline: Pipeline;
  agents: PipelineAgent[];
  providerKeys: Pick<ProviderKey, "id" | "label" | "type">[];
  /**
   * État d'exécution par agent (id → état). Quand on est en mode live,
   * piloté depuis l'extérieur ; sinon vide.
   */
  liveStates?: Record<string, "idle" | "active" | "done" | "error">;
}

const nodeTypes: NodeTypes = {
  agent: AgentFlowNode,
};

const NODE_WIDTH = 280;
const NODE_GAP_X = 80;
const NODE_HEIGHT = 200;

/**
 * Canvas React Flow affichant une pipeline comme un graphe horizontal,
 * style AI Elements workflow. Chaque agent = un node custom éditable,
 * edges animées entre nodes successifs.
 */
function PipelineWorkflowInner({
  pipeline,
  agents,
  providerKeys,
  liveStates,
}: PipelineWorkflowProps) {
  const [editingAgent, setEditingAgent] = useState<PipelineAgent | null>(null);
  const editable = !pipeline.isPreset;

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
        };
        return {
          id: agent.id,
          type: "agent",
          position: {
            x: i * (NODE_WIDTH + NODE_GAP_X),
            y: 0,
          },
          data,
          draggable: false,
        };
      }),
    [agents, providerKeys, liveStates, editable]
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      agents.slice(0, -1).map((agent, i) => {
        const next = agents[i + 1];
        const isActive =
          liveStates?.[agent.id] === "done" &&
          (liveStates?.[next.id] === "active" || liveStates?.[next.id] === "done");
        return {
          id: `${agent.id}->${next.id}`,
          source: agent.id,
          target: next.id,
          type: "smoothstep",
          animated: isActive || !liveStates,
          style: {
            stroke: "var(--color-foreground)",
            strokeOpacity: 0.4,
            strokeWidth: 1.5,
          },
        };
      }),
    [agents, liveStates]
  );

  const fitViewOptions = useMemo(
    () => ({
      padding: 0.2,
      duration: 600,
    }),
    []
  );

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  // React Flow demande des noeuds/edges contrôlés via useNodesState pour
  // permettre l'édition, mais en lecture seule on peut juste passer les
  // valeurs initiales.
  const onNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      if (!editable) return;
      const agent = agents.find((a) => a.id === node.id);
      if (agent) setEditingAgent(agent);
    },
    [agents, editable]
  );

  return (
    <>
      <div
        className="w-full rounded-2xl border border-border bg-muted/10 overflow-hidden"
        style={{ height: Math.max(NODE_HEIGHT + 120, 320) }}
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
