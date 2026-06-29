"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconBolt } from "@tabler/icons-react";
import { estimateCalls } from "@/lib/orchestrator/cost-estimate";
import type { PipelineMode } from "@/lib/orchestrator/types";

/**
 * CTA "Essayer" sur une card de pipeline — démarre une nouvelle
 * conversation pré-remplie avec un prompt d'exemple adapté au slug. Si
 * pas de match exact, ouvre simplement le chat avec la pipeline
 * sélectionnée mais sans prompt.
 */
const SAMPLE_PROMPTS: Record<string, string> = {
  "chat-simple": "tryButton.samplePrompts.chat-simple",
  "recherche-juridique": "tryButton.samplePrompts.recherche-juridique",
  "redaction-actes": "tryButton.samplePrompts.redaction-actes",
  "revue-contractuelle": "tryButton.samplePrompts.revue-contractuelle",
  "comite-strategique": "tryButton.samplePrompts.comite-strategique",
  "audit-conformite": "tryButton.samplePrompts.audit-conformite",
  "le-bureau": "tryButton.samplePrompts.le-bureau",
};

interface TryPipelineButtonProps {
  pipelineId: string;
  slug: string;
  mode: PipelineMode;
  agentCount: number;
  rounds: number | null;
}

export function TryPipelineButton({
  pipelineId,
  slug,
  mode,
  agentCount,
  rounds,
}: TryPipelineButtonProps) {
  const router = useRouter();
  const t = useTranslations("board");
  // Nombre d'appels LLM que ce pipeline déclenchera — affiché sur le CTA
  // pour que le coût soit visible AVANT de lancer (un comité 3 agents/2 tours
  // = 5 appels, pas 1).
  const calls = estimateCalls({ mode, agents: agentCount, rounds: rounds ?? 1 });

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const promptKey = SAMPLE_PROMPTS[slug];
    const prompt = promptKey ? t(promptKey) : "";
    const params = new URLSearchParams();
    params.set("pipeline", pipelineId);
    if (prompt) params.set("prompt", prompt);
    router.push(`/chat?${params.toString()}`);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 text-xs text-foreground/70 hover:text-foreground transition-colors"
      title={t("tryButton.callsTitle", { count: calls })}
    >
      <IconBolt className="size-3.5" />
      {calls > 1 ? t("tryButton.labelWithCalls", { calls }) : t("tryButton.label")}
    </button>
  );
}
