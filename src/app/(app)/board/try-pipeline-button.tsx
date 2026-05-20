"use client";

import { useRouter } from "next/navigation";
import { IconBolt } from "@tabler/icons-react";

/**
 * CTA "Essayer" sur une card de pipeline — démarre une nouvelle
 * conversation pré-remplie avec un prompt d'exemple adapté au slug. Si
 * pas de match exact, ouvre simplement le chat avec la pipeline
 * sélectionnée mais sans prompt.
 */
const SAMPLE_PROMPTS: Record<string, string> = {
  "chat-simple": "Synthétise les obligations principales d'un mandataire social en SAS.",
  "recherche-juridique":
    "Quelles sont les conditions de validité d'une clause de non-concurrence post-contractuelle en droit du travail ?",
  "redaction-actes":
    "Rédige une mise en demeure pour défaut de paiement d'une facture de prestations à 30 jours.",
  "revue-contractuelle":
    "Analyse la clause suivante : « Le Client renonce expressément à tout recours contre le Prestataire au-delà du montant facturé sur les 3 derniers mois. »",
  "comite-strategique":
    "Mon client souhaite résilier unilatéralement un contrat de distribution exclusive de 5 ans après 18 mois. Quels risques ?",
  "audit-conformite":
    "Évaluez la conformité d'un outil de scoring automatique de candidats pour le recrutement.",
};

interface TryPipelineButtonProps {
  pipelineId: string;
  slug: string;
}

export function TryPipelineButton({ pipelineId, slug }: TryPipelineButtonProps) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const prompt = SAMPLE_PROMPTS[slug] ?? "";
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
    >
      <IconBolt className="size-3.5" />
      Essayer
    </button>
  );
}
