import type { ModelMessage } from "ai";
import { estimateTokensFromChars } from "./cost-estimate";

/**
 * Budget de contexte (en tokens) pour l'historique de conversation envoyé au
 * modèle. Sur les endpoints souverains à PETIT contexte (Albert/Etalab, OVH,
 * openai_compatible auto-hébergé), un long fil juridique dépasse la fenêtre et
 * fait échouer l'appel EN PLEINE délibération — destruction de session pour un
 * produit payant. On rogne donc l'historique le plus ancien avant l'appel.
 *
 * Défaut élevé (100k) : ne rogne quasi jamais les modèles hébergés
 * (Claude/GPT-4o/Mistral-large). L'exploitant d'un petit modèle local fixe
 * LOUIS_CONTEXT_BUDGET_TOKENS à une valeur SOUS sa fenêtre (en laissant de la
 * marge pour le prompt système, les schémas d'outils et la sortie).
 */
const DEFAULT_BUDGET_TOKENS = 100_000;

export function resolveContextBudgetTokens(): number {
  const raw = process.env.LOUIS_CONTEXT_BUDGET_TOKENS;
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_BUDGET_TOKENS;
}

function messageChars(m: ModelMessage): number {
  if (typeof m.content === "string") return m.content.length;
  let total = 0;
  for (const part of m.content) total += JSON.stringify(part).length;
  return total;
}

export function estimateMessagesTokens(messages: ModelMessage[]): number {
  let chars = 0;
  for (const m of messages) chars += messageChars(m);
  return estimateTokensFromChars(chars);
}

/**
 * Sanitization en une passe : retire les résultats d'outils ORPHELINS (un
 * tool-result dont le tool-call a été rogné). Indispensable dès qu'on rogne :
 * Anthropic/OpenAI/Mistral rejettent (400) une paire tool-call/tool-result
 * dépariée au bord de l'API. Comme on rogne les messages LES PLUS ANCIENS en
 * premier, le seul orphelin possible est un message `tool` de tête dont l'appel
 * a disparu — d'où une seule passe avant→arrière suffit.
 */
function sanitizeToolMessages(messages: ModelMessage[]): ModelMessage[] {
  const seenCallIds = new Set<string>();
  const out: ModelMessage[] = [];

  for (const m of messages) {
    if (m.role === "assistant" && Array.isArray(m.content)) {
      for (const part of m.content) {
        if (part.type === "tool-call") seenCallIds.add(part.toolCallId);
      }
      out.push(m);
    } else if (m.role === "tool") {
      const kept = m.content.filter(
        (part) => part.type !== "tool-result" || seenCallIds.has(part.toolCallId)
      );
      // Si tous les résultats du message sont orphelins, on drop le message
      // entier plutôt que de laisser un message `tool` vide.
      if (kept.length > 0) out.push({ ...m, content: kept });
    } else {
      out.push(m);
    }
  }

  return out;
}

/**
 * Rogne l'historique pour tenir dans `budgetTokens`, en supprimant les messages
 * LES PLUS ANCIENS d'abord et en conservant TOUJOURS les 2 derniers (le bloc de
 * référence non-fiable injecté + la demande réelle, ou au minimum le tour
 * courant). No-op quand on est déjà sous le budget (cas courant).
 */
export function trimMessages(
  messages: ModelMessage[],
  budgetTokens: number
): ModelMessage[] {
  if (messages.length <= 2) return messages;
  if (estimateMessagesTokens(messages) <= budgetTokens) return messages;

  let kept = messages;
  while (kept.length > 2 && estimateMessagesTokens(kept) > budgetTokens) {
    kept = kept.slice(1);
  }
  return sanitizeToolMessages(kept);
}

/**
 * Garde-fou : un SEUL message peut à lui seul dépasser le budget — typiquement
 * le bloc de référence non-fiable (gros document joint), que trimMessages ne
 * rogne JAMAIS car il fait partie des 2 derniers messages conservés. Sur un
 * petit modèle souverain, l'appel échouerait. On plafonne donc le contenu
 * textuel d'un message surdimensionné, avec un marqueur neutre — le modèle
 * complète via search_documents / read_document (cf. règles du prompt système).
 */
const MAX_SINGLE_MESSAGE_FRACTION = 0.6;

function capOversizedMessages(
  messages: ModelMessage[],
  budgetTokens: number
): ModelMessage[] {
  const maxChars = Math.floor(budgetTokens * 4 * MAX_SINGLE_MESSAGE_FRACTION);
  return messages.map((m) => {
    // Seuls user/system/assistant portent un contenu string ; un message `tool`
    // a un contenu structuré (parts) et n'est pas concerné.
    if (
      m.role !== "tool" &&
      typeof m.content === "string" &&
      m.content.length > maxChars
    ) {
      return {
        ...m,
        content: `${m.content.slice(0, maxChars)}\n\n[…contenu tronqué : bloc trop volumineux pour le contexte. Le reste du document reste accessible via search_documents / read_document.]`,
      };
    }
    return m;
  });
}

/** Applique le budget résolu depuis l'environnement. */
export function applyContextBudget(messages: ModelMessage[]): ModelMessage[] {
  const budget = resolveContextBudgetTokens();
  return capOversizedMessages(trimMessages(messages, budget), budget);
}
