"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { IconMaximize, IconMinimize } from "@tabler/icons-react";
import type { Pipeline, PipelineAgent, ProviderKey } from "@/db/schema";
import { AgentEditSheet } from "../agent-edit-sheet";
import { AgentFlowNode, type AgentFlowNodeData } from "./agent-flow-node";
import { AnimatedEdge } from "./animated-edge";
import {
  removeAgentFromPipeline,
  reorderPipelineAgents,
} from "../actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
}: PipelineWorkflowProps) {
  const router = useRouter();
  const [editingAgent, setEditingAgent] = useState<PipelineAgent | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PipelineAgent | null>(null);
  const [pending, startTransition] = useTransition();
  const editable = !pipeline.isPreset && !pending;
  const mode = (pipeline.mode as "sequential" | "council" | "parallel") ?? "sequential";

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

  // Drag-to-reorder en mode sequential : lit la position X de chaque
  // node après le drop, calcule le nouvel ordre, persiste via Server
  // Action. Désactivé en council/parallel où la position 2D ne mappe
  // pas trivialement à un ordre linéaire.
  const dragReorderEnabled = editable && mode === "sequential" && agents.length > 1;
  const handleNodeDragStop = useCallback(
    (_e: React.MouseEvent | React.TouchEvent | unknown, _node: Node, nodesAfterDrag: Node[]) => {
      if (!dragReorderEnabled) return;
      const sortedByX = [...nodesAfterDrag].sort(
        (a, b) => a.position.x - b.position.x
      );
      const newOrder = sortedByX.map((n) => n.id);
      const currentOrder = agents.map((a) => a.id);
      if (newOrder.every((id, i) => id === currentOrder[i])) return;
      startTransition(async () => {
        const result = await reorderPipelineAgents(pipeline.id, newOrder);
        router.refresh();
        if (result.ok) {
          toast.success("Ordre mis à jour");
        } else {
          toast.error("Réordonnancement impossible", {
            description: result.error,
          });
        }
      });
    },
    [agents, dragReorderEnabled, pipeline.id, router]
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
          draggable: dragReorderEnabled,
        };
      }),
    [agents, providerKeys, liveStates, editable, handleDelete, positions, dragReorderEnabled]
  );

  const initialEdges = useMemo(
    () => buildEdges(agents, mode, liveStates),
    [agents, mode, liveStates]
  );

  // Padding plus serré que la valeur historique 0.2 — les cartes
  // d'agent occupent désormais ~85% de la zone visible au lieu de ~60%.
  const fitViewOptions = useMemo(
    () => ({ padding: 0.08, duration: 600 }),
    []
  );
  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  // Toggle plein écran : le wrapper devient `fixed inset-4 z-50`. Le
  // canvas occupe alors quasi tout le viewport, ce qui rend les nodes
  // beaucoup plus lisibles pour un workflow à 5+ agents.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    window.addEventListener("keydown", onKey);
    // Bloque le scroll du body pendant l'expansion pour que la roulette
    // zoome sur le canvas et pas la page derrière.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [expanded]);

  const onNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      if (!editable) return;
      const agent = agents.find((a) => a.id === node.id);
      if (agent) setEditingAgent(agent);
    },
    [agents, editable]
  );

  // Hauteur du canvas : on dimensionne en viewport units pour que les
  // nodes (280×200) gardent une taille lisible même avec 5+ agents en
  // ligne. En plein écran, on prend tout le viewport restant.
  // - sequential : 60vh (min 480px) — une ligne haute
  // - council/parallel : 70vh (min 580px) — deux lignes + arc
  const canvasStyle: React.CSSProperties = expanded
    ? { height: "calc(100vh - 2rem)" }
    : mode === "sequential"
    ? { height: "60vh", minHeight: 480 }
    : { height: "70vh", minHeight: 580 };

  return (
    <>
      <div
        className={cn(
          "relative w-full rounded-2xl border border-border bg-muted/10 overflow-hidden",
          expanded && "fixed inset-4 z-50 shadow-2xl"
        )}
        style={canvasStyle}
      >
        {/* Vignette radiale subtile pour donner du caractère au canvas */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,transparent,oklch(var(--color-foreground)/0.02)_70%,oklch(var(--color-foreground)/0.04))]"
        />

        {/* Toggle plein écran. Posé en absolute pour ne pas perturber
            le layout du ReactFlow. Au-dessus des Controls (qui sont en
            bottom-right) et de la MiniMap. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className="absolute top-3 right-3 z-10 gap-1.5 bg-card/95 backdrop-blur-sm shadow-sm"
          aria-label={expanded ? "Réduire le canvas" : "Agrandir le canvas"}
        >
          {expanded ? (
            <>
              <IconMinimize className="size-3.5" />
              Réduire <kbd className="ml-1 text-[10px] text-muted-foreground font-mono">Esc</kbd>
            </>
          ) : (
            <>
              <IconMaximize className="size-3.5" />
              Plein écran
            </>
          )}
        </Button>
        <ReactFlow
          nodes={initialNodes}
          edges={initialEdges}
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
          nodesDraggable={dragReorderEnabled}
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
          enabledModels={enabledModels}
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
