import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages, users } from "@/db/schema";
import { aggregateCosts } from "@/lib/providers/pricing";

/**
 * Début du mois courant (00:00 heure locale serveur), borne de période pour
 * l'enforcement de quota (getMonthlySpendCents).
 */
function currentMonthStart(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Dépense IA du mois courant en centimes. SOURCE UNIQUE utilisée à la fois par
 * l'enforcement de quota (/api/chat) ET par l'affichage (page usage, dashboard)
 * pour garantir que le montant montré au membre == celui qui déclenche le
 * blocage 402. Convention identique à l'enforcement historique : EUR et USD
 * additionnés 1:1 — imprécis sur la devise, mais c'est la vérité du plafond.
 */
export async function getMonthlySpendCents(userId: string): Promise<number> {
  const rows = await db
    .select({
      modelId: messages.modelId,
      inputTokens: messages.inputTokens,
      outputTokens: messages.outputTokens,
    })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(
      and(
        eq(conversations.userId, userId),
        eq(messages.role, "assistant"),
        gte(messages.createdAt, currentMonthStart())
      )
    );
  const totals = aggregateCosts(rows);
  return Math.round((totals.EUR + totals.USD) * 100);
}

/** Plafond mensuel (centimes) défini par l'admin, ou null si aucun. */
export async function getUserMonthlyQuotaCents(
  userId: string
): Promise<number | null> {
  const [row] = await db
    .select({ monthlyQuotaCents: users.monthlyQuotaCents })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.monthlyQuotaCents ?? null;
}
