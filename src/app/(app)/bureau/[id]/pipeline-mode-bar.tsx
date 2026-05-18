"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  IconCircleArrowRight,
  IconUsersGroup,
  IconLayoutGrid,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Pipeline } from "@/db/schema";
import { updatePipelineMeta } from "../actions";

type Mode = "sequential" | "council" | "parallel";

const MODES: { value: Mode; label: string; icon: typeof IconCircleArrowRight; pitch: string }[] = [
  {
    value: "sequential",
    label: "Séquentiel",
    icon: IconCircleArrowRight,
    pitch:
      "Chaîne : A → B → C. Chaque agent voit la sortie des précédents et l'enrichit. Idéal pour des workflows linéaires (recherche → rédaction → relecture).",
  },
  {
    value: "council",
    label: "Conseil (débat)",
    icon: IconUsersGroup,
    pitch:
      "Comité : N tours où chaque membre voit les positions des autres et révise la sienne. Le dernier agent synthétise. Idéal pour les questions qui méritent contradiction.",
  },
  {
    value: "parallel",
    label: "Parallèle",
    icon: IconLayoutGrid,
    pitch:
      "Fan-out : tous les agents travaillent en parallèle sur la même question, le dernier synthétise. Plus rapide qu'un conseil, sans débat entre eux.",
  },
];

interface PipelineModeBarProps {
  pipeline: Pipeline;
}

export function PipelineModeBar({ pipeline }: PipelineModeBarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isPreset = pipeline.isPreset;
  const mode = (pipeline.mode as Mode) ?? "sequential";
  const rounds = pipeline.rounds ?? 1;

  function update(payload: Partial<{ mode: Mode; rounds: number }>) {
    startTransition(async () => {
      await updatePipelineMeta(pipeline.id, {
        name: pipeline.name,
        description: pipeline.description,
        ...payload,
      });
      router.refresh();
    });
  }

  const current = MODES.find((m) => m.value === mode) ?? MODES[0];

  return (
    <div className="rounded-xl border border-border bg-card/30 p-4">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Mode d&apos;orchestration
          </div>
          <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
            {current.pitch}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={mode}
            onValueChange={(v) => update({ mode: v as Mode })}
            disabled={isPreset || pending}
          >
            <SelectTrigger size="sm" className="h-9 min-w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map((m) => {
                const Icon = m.icon;
                return (
                  <SelectItem key={m.value} value={m.value}>
                    <Icon className="size-3.5" />
                    {m.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {mode === "council" && (
            <Select
              value={String(rounds)}
              onValueChange={(v) => update({ rounds: Number(v) })}
              disabled={isPreset || pending}
            >
              <SelectTrigger size="sm" className="h-9 min-w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} tour{n > 1 ? "s" : ""} de débat
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {mode === "council" && (
        <p
          className={cn(
            "mt-3 text-[11px] text-muted-foreground border-t border-border/40 pt-2"
          )}
        >
          ⚠️ Coût multiplié par {rounds} × {Math.max(0, 1)} (chaque tour rejoue
          chaque débateur). Le synthétiseur final ne tourne qu&apos;une fois.
        </p>
      )}

      {isPreset && (
        <p className="mt-3 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
          Mode verrouillé sur les presets — clonez la pipeline pour le
          modifier.
        </p>
      )}
    </div>
  );
}
