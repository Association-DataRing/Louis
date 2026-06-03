"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconArrowUp, IconArrowDown, IconFlag } from "@tabler/icons-react";
import type { PipelineAgent } from "@/db/schema";
import { roleMeta } from "../agent-role-meta";
import { reorderPipelineAgents } from "../actions";

const MODE_HINT: Record<string, string> = {
  sequential:
    "Chaîne : chaque agent voit la sortie des précédents. Le dernier agent rend la réponse finale.",
  council:
    "Conseil : tous les agents délibèrent (N tours). Le dernier agent — le terminal — synthétise et rend la réponse.",
  parallel:
    "Parallèle : les agents travaillent en même temps sur la question. Le dernier agent — le terminal — agrège et rend la réponse.",
};

/**
 * Panneau d'ordre d'exécution explicite (Lot 3) : liste numérotée,
 * réordonnable au clavier/souris via des flèches haut/bas, indépendante de la
 * géométrie du canvas. Rend visible quel agent est TERMINAL (« répond en
 * dernier ») dans les trois modes. Persiste via reorderPipelineAgents
 * (réindexe `position`).
 */
export function ExecutionOrderPanel({
  pipelineId,
  agents,
  mode,
  editable,
}: {
  pipelineId: string;
  agents: PipelineAgent[];
  mode: "sequential" | "council" | "parallel" | "iterative";
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [order, setOrder] = useState<PipelineAgent[]>(
    [...agents].sort((a, b) => a.position - b.position)
  );

  // Resync quand les agents changent côté serveur (ajout/suppression/refresh).
  // Pattern React 19 « set state during render » (pas d'effet).
  const propKey = agents.map((a) => a.id).join("|");
  const [seenKey, setSeenKey] = useState(propKey);
  if (propKey !== seenKey) {
    setSeenKey(propKey);
    setOrder([...agents].sort((a, b) => a.position - b.position));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    startTransition(async () => {
      const result = await reorderPipelineAgents(
        pipelineId,
        next.map((a) => a.id)
      );
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  if (agents.length <= 1) return null;

  return (
    <section className="mt-6 rounded-lg border border-border">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-heading text-sm">Ordre d&apos;exécution</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {MODE_HINT[mode] ?? MODE_HINT.sequential}
        </p>
      </div>
      <ol className="divide-y divide-border">
        {order.map((a, i) => {
          const meta = roleMeta(a.role);
          const Icon = meta.icon;
          const isTerminal = i === order.length - 1;
          return (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-5 text-center text-xs tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm">
                {a.label}
              </span>
              {isTerminal && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-foreground/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/80">
                  <IconFlag className="size-3" /> répond en dernier
                </span>
              )}
              {editable && (
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    disabled={pending || i === 0}
                    onClick={() => move(i, -1)}
                    className="grid size-8 place-items-center rounded-md transition-colors hover:bg-accent disabled:opacity-30"
                    aria-label={`Monter ${a.label}`}
                  >
                    <IconArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={pending || i === order.length - 1}
                    onClick={() => move(i, 1)}
                    className="grid size-8 place-items-center rounded-md transition-colors hover:bg-accent disabled:opacity-30"
                    aria-label={`Descendre ${a.label}`}
                  >
                    <IconArrowDown className="size-4" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
