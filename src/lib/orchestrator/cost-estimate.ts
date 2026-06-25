import { computeCost, type Cost } from "@/lib/providers/pricing";
import {
  DEFAULT_ITERATIVE_ROUNDS,
  MAX_COUNCIL_ROUNDS,
  MAX_ITERATIVE_ROUNDS,
  type PipelineMode,
} from "./types";

const clampRounds = (rounds: number, max: number): number =>
  Math.max(1, Math.min(Math.floor(rounds), max));

/**
 * Nombre d'appels LLM qu'un run de pipeline déclenchera, selon le mode.
 * C'est le vrai driver de coût d'un run multi-agents — exposé AU POINT DE
 * DÉPENSE (composer du chat, CTA « Essayer » du board) et non plus seulement
 * dans l'éditeur. Source de vérité unique, réutilisée par pipeline-mode-bar.
 *
 * - sequential : un appel par agent (A → B → C).
 * - council    : débatteurs (agents − 1) × tours + 1 synthèse.
 * - parallel   : workers (agents − 1) en parallèle + 1 synthèse = agents.
 * - iterative  : le chercheur tourne `rounds` fois + 1 synthèse (si ≥ 2 agents).
 *
 * Un pipeline mono-agent (ou vide) = 1 appel (sauf itératif : `rounds` appels).
 */
export function estimateCalls(opts: {
  mode: PipelineMode;
  agents: number;
  rounds?: number;
}): number {
  const agents = Math.max(1, Math.floor(opts.agents));
  if (opts.mode === "iterative") {
    // Même défaut (2) et même plafond (4) que l'exécution (orchestrator).
    const rounds = clampRounds(
      opts.rounds ?? DEFAULT_ITERATIVE_ROUNDS,
      MAX_ITERATIVE_ROUNDS
    );
    // Le chercheur (1er agent) tourne `rounds` fois ; +1 synthèse si terminal distinct.
    return rounds + (agents > 1 ? 1 : 0);
  }
  if (agents <= 1) return 1;
  switch (opts.mode) {
    case "council":
      // Même plafond (6) que l'exécution, sinon le coût sur-estime.
      return clampRounds(opts.rounds ?? 1, MAX_COUNCIL_ROUNDS) * (agents - 1) + 1;
    case "parallel":
      return agents - 1 + 1;
    case "maestro":
      // Routage dynamique : le nombre réel d'appels dépend des délégations
      // décidées par le Maestro. Heuristique : chaque membre consulté une
      // fois + le Maestro — l'UI suffixe déjà « estimé ».
      return agents;
    case "sequential":
    default:
      return agents;
  }
}

/** Heuristique grossière de tokenisation : ~4 caractères par token. */
export function estimateTokensFromChars(chars: number): number {
  return Math.ceil(Math.max(0, chars) / 4);
}

/** Tokens de sortie supposés par appel pour l'estimation (réponse type). */
const ASSUMED_OUTPUT_TOKENS_PER_CALL = 700;

/**
 * Estimation de coût AVANT génération. Volontairement une fourchette : les
 * tokens de sortie sont inconnus à l'avance, donc l'appelant suffixe
 * « estimé ». Retourne `null` si le modèle n'a pas de prix connu
 * (auto-hébergé / hors table) → l'appelant affiche « auto-hébergé » plutôt
 * qu'un « 0 € » trompeur.
 */
export function estimateRunCost(opts: {
  modelId: string | null | undefined;
  calls: number;
  promptChars: number;
}): Cost | null {
  const calls = Math.max(1, opts.calls);
  const inputTokens = estimateTokensFromChars(opts.promptChars) * calls;
  const outputTokens = ASSUMED_OUTPUT_TOKENS_PER_CALL * calls;
  return computeCost(opts.modelId, inputTokens, outputTokens);
}
