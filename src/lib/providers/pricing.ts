/**
 * Pricing par modèle — sources : pages tarifaires publiques des providers
 * au 13 mai 2026. Les prix peuvent changer ; reverifier trimestriellement.
 *
 * Convention : prix en EUR pour les providers facturés en EUR
 * (Mistral, Scaleway, OVH, Albert qui est gratuit), en USD pour les autres
 * (Anthropic, OpenAI). Pas de conversion auto — l'utilisateur voit la
 * devise réelle de facturation.
 */

export type ProviderPricing = {
  /** Coût pour 1 million de tokens d'entrée. */
  inputPerMillion: number;
  /** Coût pour 1 million de tokens de sortie. */
  outputPerMillion: number;
  currency: "EUR" | "USD";
};

export const MODEL_PRICING: Record<string, ProviderPricing> = {
  // ─── Mistral (EUR) ──────────────────────────────────────────────────────
  "mistral-small-latest": { inputPerMillion: 0.2, outputPerMillion: 0.6, currency: "EUR" },
  "mistral-medium-latest": { inputPerMillion: 0.4, outputPerMillion: 2.0, currency: "EUR" },
  "mistral-large-latest": { inputPerMillion: 2.0, outputPerMillion: 6.0, currency: "EUR" },
  "codestral-latest": { inputPerMillion: 0.3, outputPerMillion: 0.9, currency: "EUR" },
  "ministral-8b-latest": { inputPerMillion: 0.1, outputPerMillion: 0.1, currency: "EUR" },

  // ─── Scaleway Generative APIs (EUR) ─────────────────────────────────────
  "mistral-nemo-instruct-2407": { inputPerMillion: 0.15, outputPerMillion: 0.15, currency: "EUR" },
  "mistral-small-3-instruct-2503": { inputPerMillion: 0.2, outputPerMillion: 0.6, currency: "EUR" },
  "llama-3.3-70b-instruct": { inputPerMillion: 0.8, outputPerMillion: 0.8, currency: "EUR" },
  "llama-3.1-8b-instruct": { inputPerMillion: 0.2, outputPerMillion: 0.2, currency: "EUR" },
  "qwen2.5-coder-32b-instruct": { inputPerMillion: 0.9, outputPerMillion: 0.9, currency: "EUR" },

  // ─── OVHcloud AI Endpoints (EUR, indicatif) ─────────────────────────────
  "Meta-Llama-3_1-8B-Instruct": { inputPerMillion: 0.1, outputPerMillion: 0.1, currency: "EUR" },
  "Meta-Llama-3_1-70B-Instruct": { inputPerMillion: 0.7, outputPerMillion: 0.7, currency: "EUR" },
  "Mistral-7B-Instruct-v0_3": { inputPerMillion: 0.1, outputPerMillion: 0.1, currency: "EUR" },
  "Mixtral-8x7B-Instruct-v0_1": { inputPerMillion: 0.6, outputPerMillion: 0.6, currency: "EUR" },

  // ─── Albert (Etalab) ─ Gratuit pour le secteur public ───────────────────
  "AgentPublic/llama3-instruct-8b": { inputPerMillion: 0, outputPerMillion: 0, currency: "EUR" },
  "AgentPublic/llama3-70b-instruct": { inputPerMillion: 0, outputPerMillion: 0, currency: "EUR" },

  // ─── Anthropic (USD) ────────────────────────────────────────────────────
  "claude-haiku-4-5": { inputPerMillion: 1.0, outputPerMillion: 5.0, currency: "USD" },
  "claude-sonnet-4-7": { inputPerMillion: 3.0, outputPerMillion: 15.0, currency: "USD" },
  "claude-opus-4-7": { inputPerMillion: 15.0, outputPerMillion: 75.0, currency: "USD" },

  // ─── OpenAI (USD) ───────────────────────────────────────────────────────
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6, currency: "USD" },
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10, currency: "USD" },
  "gpt-4.1-mini": { inputPerMillion: 0.4, outputPerMillion: 1.6, currency: "USD" },
  "gpt-4.1": { inputPerMillion: 2.0, outputPerMillion: 8.0, currency: "USD" },
  "o3-mini": { inputPerMillion: 1.1, outputPerMillion: 4.4, currency: "USD" },
};

export type Cost = {
  amount: number;
  currency: "EUR" | "USD";
};

export function computeCost(
  modelId: string | null | undefined,
  inputTokens: number,
  outputTokens: number
): Cost | null {
  if (!modelId) return null;
  const p = MODEL_PRICING[modelId];
  if (!p) return null;
  const amount =
    (inputTokens * p.inputPerMillion + outputTokens * p.outputPerMillion) /
    1_000_000;
  return { amount, currency: p.currency };
}

/**
 * Agrège plusieurs coûts par devise (on ne convertit pas auto).
 * Retourne un Record<currency, total>.
 */
export function aggregateCosts(
  rows: Array<{
    modelId: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
  }>
): Record<"EUR" | "USD", number> {
  const totals: Record<"EUR" | "USD", number> = { EUR: 0, USD: 0 };
  for (const r of rows) {
    const c = computeCost(r.modelId, r.inputTokens ?? 0, r.outputTokens ?? 0);
    if (!c) continue;
    totals[c.currency] += c.amount;
  }
  return totals;
}

export function formatCost(c: Cost | null | undefined): string {
  if (!c) return "—";
  const sym = c.currency === "EUR" ? "€" : "$";
  if (c.amount === 0) return `0 ${sym}`;
  if (c.amount < 0.001) return `< 0,001 ${sym}`;
  if (c.amount < 1) return `${c.amount.toFixed(3).replace(".", ",")} ${sym}`;
  return `${c.amount.toFixed(2).replace(".", ",")} ${sym}`;
}

export function formatTotals(totals: Record<"EUR" | "USD", number>): string {
  const parts: string[] = [];
  if (totals.EUR > 0) parts.push(formatCost({ amount: totals.EUR, currency: "EUR" }));
  if (totals.USD > 0) parts.push(formatCost({ amount: totals.USD, currency: "USD" }));
  return parts.length > 0 ? parts.join(" · ") : "—";
}
