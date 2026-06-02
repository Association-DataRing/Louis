"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Pipeline, PipelineAgent, ProviderKey } from "@/db/schema";
import type {
  AgentSourceFolder,
  AgentSourceDocument,
} from "@/lib/projects/scope";
import { AgentEditSheet } from "../agent-edit-sheet";
import { AgentFlowNode, type AgentFlowNodeData } from "./agent-flow-node";
import { AnimatedEdge } from "./animated-edge";
import {
  removeAgentFromPipeline,
  reorderPipelineAgents,
  resetPipelineLayout,
  updateAgentCanvasPosition,
} from "../actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PipelineWorkflowProps {
  pipeline: Pipeline;
  agents: PipelineAgent[];
  providerKeys: Pick<ProviderKey, "id" | "label" | "type">[];
  /** Modèles ajoutés via /settings/models/library. */
  enabledModels?: Array<{
    providerType: string;
    modelId: string;
    label: string;
    hint?: string | null;
  }>;
  liveStates?: Record<string, "idle" | "active" | "done" | "error">;
  /** Outils réellement disponibles pour l'utilisateur (multi-select allowlist). */
  availableTools?: string[];
  /** Dossiers/documents de l'utilisateur (sélecteurs de portée RAG par agent). */
  availableFolders?: AgentSourceFolder[];
  availableDocuments?: AgentSourceDocument[];
}

const nodeTypes: NodeTypes = {
  agent: AgentFlowNode,
};

const edgeTypes: EdgeTypes = {
  animated: AnimatedEdge,
};

const NODE_WIDTH = 280;
const NODE_GAP_X = 80;
const NODE_HEIGHT = 200;
const NODE_GAP_Y = 80;

/**
 * Calcule les positions de chaque node selon le mode :
 * - sequential : grille horizontale (gauche → droite)
 * - council    : synthétiseur centré en bas, débatteurs en arc au-dessus
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

  // council & parallel : workers/débatteurs en arc en haut, synth centré au milieu
  // de l'arc en bas. Le synthétiseur devient l'élément central visuel.
  const synthIndex = agents.length - 1;
  const workers = agents.slice(0, -1);
  const totalWidth = workers.length * (NODE_WIDTH + NODE_GAP_X) - NODE_GAP_X;
  const synthX = totalWidth / 2 - NODE_WIDTH / 2;

  // Léger arc : on baisse légèrement les workers extrêmes pour créer un
  // effet "demi-cercle" naturel, qui converge vers le synthétiseur.
  const arcOffset = workers.length > 2 ? 20 : 0;

  return agents.map((_, i) => {
    if (i === synthIndex) {
      return { x: synthX, y: NODE_HEIGHT + NODE_GAP_Y };
    }
    // Workers : courbe parabolique légère (centre haut, bords bas)
    const ratio = workers.length > 1 ? i / (workers.length - 1) : 0.5;
    const arcY = -arcOffset * (1 - 4 * Math.pow(ratio - 0.5, 2));
    return {
      x: i * (NODE_WIDTH + NODE_GAP_X),
      y: arcY,
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
        type: "animated",
        data: { active },
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
      type: "animated",
      data: { active },
    };
  });

  // En council, on rajoute des edges de débat entre workers (en pointillés
  // subtils) — les membres voient mutuellement leurs positions au tour
  // suivant. Pour ≥3 débatteurs, on ne dessine qu'avec les voisins
  // immédiats pour éviter le spaghetti.
  if (mode === "council" && workers.length > 1) {
    for (let i = 0; i < workers.length - 1; i++) {
      const a = workers[i];
      const b = workers[i + 1];
      edges.push({
        id: `${a.id}<->${b.id}`,
        source: a.id,
        target: b.id,
        type: "animated",
        data: { dashed: true },
      });
    }
  }

  return edges;
}

function PipelineWorkflowInner({
  pipeline,
  agents,
  providerKeys,
  enabledModels,
  liveStates,
  availableTools,
  availableFolders,
  availableDocuments,
}: PipelineWorkflowProps) {
  const router = useRouter();
  const [editingAgent, setEditingAgent] = useState<PipelineAgent | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PipelineAgent | null>(null);
  const [pending, startTransition] = useTransition();
  const editable = !pipeline.isPreset && !pending;
  const mode = (pipeline.mode as "sequential" | "council" | "parallel") ?? "sequential";
  // H7 : le drag ne ré-ordonne l'exécution QU'en mode séquentiel (en
  // council/parallel, la position n'a aucun effet sur l'ordre → drag trompeur).
  const dragEnabled = editable && mode === "sequential" && agents.length > 1;

  const handleDelete = useCallback((agent: PipelineAgent) => {
    setPendingDelete(agent);
  }, []);

  function confirmDelete() {
    if (!pendingDelete) return;
    const agent = pendingDelete;
    startTransition(async () => {
      const result = await removeAgentFromPipeline(agent.id);
      router.refresh();
      setPendingDelete(null);
      if (result.ok) {
        toast.success("Agent retiré", {
          description: `${agent.label} a été retiré de la pipeline.`,
        });
      } else {
        toast.error("Suppression impossible", { description: result.error });
      }
    });
  }

  // Coordonnées finales : canvasX/Y custom si présent, sinon layoutNodes.
  // Recalculé uniquement quand la liste d'agents (DB) change — pas pendant
  // le drag, qui est géré en interne par useNodesState.
  const computedNodes: Node[] = useMemo(() => {
    const auto = layoutNodes(agents, mode);
    return agents.map((agent, i) => {
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
        position: {
          x: agent.canvasX ?? auto[i].x,
          y: agent.canvasY ?? auto[i].y,
        },
        data,
        draggable: dragEnabled,
      };
    });
  }, [agents, providerKeys, liveStates, editable, mode, dragEnabled, handleDelete]);

  const computedEdges = useMemo(
    () => buildEdges(agents, mode, liveStates),
    [agents, mode, liveStates]
  );

  // useNodesState/useEdgesState : nodes mutables gérés en interne par
  // React Flow → le drag bouge le node en temps réel sous le curseur.
  // Avant on passait `nodes={memo}` sans onNodesChange = mode controlled
  // figé, donc rien ne bougeait pendant le drag.
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(computedEdges);

  // Re-sync nodes/edges quand la source de vérité (DB / agents prop)
  // change : ajout/retrait d'agent, reset layout, refresh router.
  useEffect(() => {
    setNodes(computedNodes);
  }, [computedNodes, setNodes]);
  useEffect(() => {
    setEdges(computedEdges);
  }, [computedEdges, setEdges]);

  const handleNodeDragStop = useCallback(
    (
      _e: React.MouseEvent | React.TouchEvent | unknown,
      node: Node,
      nodesAfterDrag: Node[]
    ) => {
      if (!dragEnabled) return;

      // (1) Persiste la position custom (le node a déjà bougé en local
      // via useNodesState pendant le drag, on persiste juste la valeur
      // finale en DB — sans revalidate pour éviter un flash).
      void updateAgentCanvasPosition(node.id, node.position.x, node.position.y);

      // (2) En mode sequential, ré-ordonne par X pour que l'ordre
      // d'exécution suive la disposition visuelle. Le node garde sa
      // position custom (plus de snap à la grille).
      if (mode !== "sequential") return;
      const sortedByX = [...nodesAfterDrag].sort(
        (a, b) => a.position.x - b.position.x
      );
      const newOrder = sortedByX.map((n) => n.id);
      const currentOrder = agents.map((a) => a.id);
      if (newOrder.every((id, i) => id === currentOrder[i])) return;
      startTransition(async () => {
        const result = await reorderPipelineAgents(pipeline.id, newOrder);
        router.refresh();
        if (!result.ok) {
          toast.error("Réordonnancement impossible", {
            description: result.error,
          });
        }
      });
    },
    [agents, dragEnabled, mode, pipeline.id, router]
  );

  const hasCustomLayout = agents.some(
    (a) => a.canvasX !== null || a.canvasY !== null
  );
  const handleResetLayout = useCallback(() => {
    startTransition(async () => {
      const result = await resetPipelineLayout(pipeline.id);
      router.refresh();
      if (result.ok) {
        toast.success("Disposition réinitialisée");
      } else {
        toast.error("Réinitialisation impossible", {
          description: result.error,
        });
      }
    });
  }, [pipeline.id, router]);

  const fitViewOptions = useMemo(
    () => ({ padding: 0.12, duration: 400 }),
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

  // Hauteur du canvas en viewport units pour que les nodes (280×200)
  // gardent une taille lisible même avec 5+ agents en ligne.
  // - sequential : 60vh (min 480px)
  // - council/parallel : 70vh (min 580px)
  const canvasStyle: React.CSSProperties =
    mode === "sequential"
      ? { height: "60vh", minHeight: 480 }
      : { height: "70vh", minHeight: 580 };

  return (
    <>
      <div
        className="relative w-full rounded-2xl border border-border bg-muted/10 overflow-hidden"
        style={canvasStyle}
      >
        {/* Vignette radiale subtile pour donner du caractère au canvas */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,transparent,color-mix(in_oklch,var(--color-foreground)_2%,transparent)_70%,color-mix(in_oklch,var(--color-foreground)_4%,transparent))]"
        />

        {/* Bouton reset : visible dès qu'au moins un agent a des
            coordonnées custom (canvasX/Y non null). */}
        {editable && hasCustomLayout && (
          <div className="absolute top-3 right-3 z-10">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetLayout}
              disabled={pending}
              className="gap-1.5 bg-card/95 backdrop-blur-sm shadow-sm"
              title="Remet les nodes à leur position automatique selon le mode"
            >
              Réinitialiser la disposition
            </Button>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={fitViewOptions}
          proOptions={proOptions}
          minZoom={0.4}
          maxZoom={1.5}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          nodesDraggable={dragEnabled}
          nodesConnectable={false}
          edgesFocusable={false}
          onNodeClick={onNodeClick}
          onNodeDragStop={(e, n, all) => handleNodeDragStop(e, n, all)}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1.2}
            color="var(--color-border)"
          />
          <Controls
            position="bottom-right"
            showInteractive={false}
            className="!bg-card !border !border-border !shadow-sm"
          />
          {/* MiniMap : utile à partir de 6 agents (avant ça tient à l'écran
              et la mini-carte affiche surtout du vide — looks broken). */}
          {agents.length > 5 && (
            <MiniMap
              pannable
              zoomable
              className="!bg-card !border !border-border"
              maskColor="color-mix(in oklab, var(--foreground) 6%, transparent)"
              nodeColor="var(--color-foreground)"
            />
          )}
        </ReactFlow>
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

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Retirer « {pendingDelete?.label} » de la pipeline ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cet agent ne participera plus aux exécutions futures. Vous
              pourrez toujours l&apos;ajouter à nouveau. Les exécutions
              passées conservent leur trace dans l&apos;audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? "Suppression…" : "Retirer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
