import { and, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { toolInvocations } from "@/db/schema";

export interface ToolStatRow {
  toolName: string;
  category: string;
  calls: number;
  failed: number;
  successRate: number;
  avgMs: number;
  maxMs: number;
}

export interface ToolObservability {
  totalCalls: number;
  failedCalls: number;
  successRate: number;
  byTool: ToolStatRow[];
}

/**
 * Agrège la télémétrie des outils sur une fenêtre temporelle (par défaut le
 * mois courant). Pensé pour la page usage : « quel outil est lent ou échoue,
 * et à quelle fréquence ». Scopé optionnellement à un utilisateur.
 *
 * Une seule requête `GROUP BY` côté Postgres (pas de N+1) — l'équivalent du
 * `aggregate()` SQLite de vLLM Studio, en SQL natif Drizzle.
 */
export async function aggregateToolStats(opts: {
  since: Date;
  userId?: string;
}): Promise<ToolObservability> {
  const where = opts.userId
    ? and(
        gte(toolInvocations.createdAt, opts.since),
        sql`${toolInvocations.userId} = ${opts.userId}`
      )
    : gte(toolInvocations.createdAt, opts.since);

  const rows = await db
    .select({
      toolName: toolInvocations.toolName,
      category: toolInvocations.category,
      calls: sql<number>`count(*)::int`,
      failed: sql<number>`sum(case when ${toolInvocations.success} then 0 else 1 end)::int`,
      avgMs: sql<number>`coalesce(round(avg(${toolInvocations.durationMs})), 0)::int`,
      maxMs: sql<number>`coalesce(max(${toolInvocations.durationMs}), 0)::int`,
    })
    .from(toolInvocations)
    .where(where)
    .groupBy(toolInvocations.toolName, toolInvocations.category)
    .orderBy(sql`count(*) desc`)
    .limit(50);

  const byTool: ToolStatRow[] = rows.map((r) => ({
    toolName: r.toolName,
    category: r.category,
    calls: r.calls,
    failed: r.failed,
    successRate: r.calls > 0 ? ((r.calls - r.failed) / r.calls) * 100 : 0,
    avgMs: r.avgMs,
    maxMs: r.maxMs,
  }));

  const totalCalls = byTool.reduce((n, r) => n + r.calls, 0);
  const failedCalls = byTool.reduce((n, r) => n + r.failed, 0);

  return {
    totalCalls,
    failedCalls,
    successRate:
      totalCalls > 0 ? ((totalCalls - failedCalls) / totalCalls) * 100 : 0,
    byTool,
  };
}
