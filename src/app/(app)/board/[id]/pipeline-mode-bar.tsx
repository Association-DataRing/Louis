"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconAlertTriangle } from "@tabler/icons-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Pipeline } from "@/db/schema";
import { cn } from "@/lib/utils";
import { estimateCalls } from "@/lib/orchestrator/cost-estimate";
import { MODE_META, type PipelineModeKey } from "../mode-meta";
import { updatePipelineMeta } from "../actions";

interface PipelineModeBarProps {
  pipeline: Pipeline;
  agentCount: number;
}

export function PipelineModeBar({ pipeline, agentCount }: PipelineModeBarProps) {
  const router = useRouter();
  const t = useTranslations("board");
  const [pending, startTransition] = useTransition();
  const isPreset = pipeline.isPreset;
  const mode = (pipeline.mode as PipelineModeKey) ?? "sequential";
  const rounds = pipeline.rounds ?? 1;

  function update(payload: Partial<{ mode: PipelineModeKey; rounds: number }>) {
    startTransition(async () => {
      await updatePipelineMeta(pipeline.id, {
        name: pipeline.name,
        description: pipeline.description,
        ...payload,
      });
      router.refresh();
    });
  }

  const modes: PipelineModeKey[] = [
    "sequential",
    "council",
    "parallel",
    "iterative",
    "maestro",
  ];
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleRadioKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    if (isPreset || pending) return;
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIndex = (index + 1) % modes.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIndex = (index - 1 + modes.length) % modes.length;
    }
    if (nextIndex === null) return;
    e.preventDefault();
    const nextMode = modes[nextIndex];
    radioRefs.current[nextIndex]?.focus();
    if (nextMode !== mode) update({ mode: nextMode });
  }

  return (
    <div className="py-4 border-y border-border">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-foreground/70">
            {t("modeBar.orchestrationMode")}
          </div>
        </div>

        {(mode === "council" || mode === "iterative") && (
          <Select
            value={String(rounds)}
            onValueChange={(v) => update({ rounds: Number(v) })}
            disabled={isPreset || pending}
          >
            <SelectTrigger size="sm" className="h-9 min-w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {t("modeBar.roundsOption", { count: n })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label={t("modeBar.orchestrationMode")}
        className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2"
      >
        {modes.map((m, i) => {
          const meta = MODE_META[m];
          const Icon = meta.icon;
          const selected = mode === m;
          const disabled = isPreset || pending;
          return (
            <button
              key={m}
              ref={(el) => {
                radioRefs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t("modeBar.modeAria", {
                label: t(meta.labelKey),
                pitch: t(meta.pitchKey),
              })}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => !selected && update({ mode: m })}
              onKeyDown={(e) => handleRadioKeyDown(e, i)}
              className={cn(
                "group relative flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                selected
                  ? "border-foreground/40 bg-foreground/5 shadow-sm"
                  : "border-border bg-card hover:border-foreground/20 hover:bg-card/80",
                disabled && !selected && "opacity-50 cursor-not-allowed",
                !disabled && !selected && "cursor-pointer"
              )}
            >
              <div
                className={cn(
                  "size-9 rounded-lg grid place-items-center shrink-0 transition-colors",
                  selected ? "bg-foreground/10" : "bg-muted"
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t(meta.labelKey)}</span>
                  {selected && (
                    <span className="inline-flex items-center text-[10px] uppercase tracking-wider text-foreground/70 font-medium">
                      {t("modeBar.active")}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                  {t(meta.pitchKey)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {(() => {
        const calls = estimateCalls({ mode, agents: agentCount, rounds });
        // On n'affiche l'avertissement de coût que pour les runs multi-appels
        // (séquentiel mono-agent = 1 appel, rien à signaler).
        if (calls <= 1) return null;
        const debaters = Math.max(0, agentCount - 1);
        const breakdown: string =
          mode === "council"
            ? t("modeBar.breakdownCouncil", { debaters, rounds })
            : mode === "iterative"
              ? t("modeBar.breakdownIterative", {
                  rounds,
                  multi: agentCount > 1 ? "yes" : "no",
                })
              : mode === "parallel"
                ? t("modeBar.breakdownParallel", { debaters })
                : mode === "maestro"
                  ? t("modeBar.breakdownMaestro", { debaters })
                  : t("modeBar.breakdownSequential", { count: agentCount });
        return (
          <p className="mt-3 flex items-start gap-1 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            <IconAlertTriangle className="size-3.5 shrink-0 mt-px text-warning" />
            <span>{t("modeBar.costEstimate", { count: calls, breakdown })}</span>
          </p>
        );
      })()}

      {isPreset && (
        <p className="mt-3 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
          {t("modeBar.presetLocked")}
        </p>
      )}
    </div>
  );
}
