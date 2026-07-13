import { redirect } from "next/navigation";
import { and, eq, gte, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import {
  aggregateCosts,
  computeCost,
  formatCost,
  formatTotals,
} from "@/lib/providers/pricing";
import { getUserMonthlyQuotaCents } from "@/lib/usage/quota";
import { aggregateToolStats } from "@/lib/observability/query";

export default async function UsagePage() {
  const t = await getTranslations("settings.usage");
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthLabel = now.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const rowsThisMonth = await db
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
        gte(messages.createdAt, monthStart)
      )
    );

  const totalsMonth = aggregateCosts(rowsThisMonth);
  // Même formule que l'enforcement (route.ts via getMonthlySpendCents) pour
  // que le montant affiché == celui qui déclenche le blocage 402.
  const spentCentsMonth = Math.round((totalsMonth.EUR + totalsMonth.USD) * 100);
  const quotaCents = await getUserMonthlyQuotaCents(userId);
  const totalInputTokens = rowsThisMonth.reduce(
    (n, r) => n + (r.inputTokens ?? 0),
    0
  );
  const totalOutputTokens = rowsThisMonth.reduce(
    (n, r) => n + (r.outputTokens ?? 0),
    0
  );
  const messageCount = rowsThisMonth.length;

  const perModel = new Map<
    string,
    { count: number; input: number; output: number }
  >();
  for (const r of rowsThisMonth) {
    const key = r.modelId ?? t("unspecifiedModel");
    const entry = perModel.get(key) ?? { count: 0, input: 0, output: 0 };
    entry.count += 1;
    entry.input += r.inputTokens ?? 0;
    entry.output += r.outputTokens ?? 0;
    perModel.set(key, entry);
  }
  const modelRows = Array.from(perModel.entries())
    .map(([modelId, v]) => ({
      modelId,
      messages: v.count,
      input: v.input,
      output: v.output,
      cost: computeCost(modelId, v.input, v.output),
    }))
    .sort((a, b) => {
      const ca = a.cost?.amount ?? 0;
      const cb = b.cost?.amount ?? 0;
      if (cb !== ca) return cb - ca;
      return b.messages - a.messages;
    });

  const rowsAllTime = await db
    .select({
      modelId: messages.modelId,
      inputTokens: messages.inputTokens,
      outputTokens: messages.outputTokens,
    })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(
      and(eq(conversations.userId, userId), eq(messages.role, "assistant"))
    );
  const totalsAllTime = aggregateCosts(rowsAllTime);
  const allTimeMessages = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(eq(conversations.userId, userId)))
    .then((r) => r[0].n);

  // Fiabilité des outils ce mois-ci (Légifrance, Pappers, RAG, génération de
  // documents, MCP) — latence + taux de succès. Répond à « quel outil rame ou
  // échoue », distinct du coût IA.
  const toolStats = await aggregateToolStats({ since: monthStart, userId });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-8 md:py-14">
      <header className="mb-12">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          {capitalize(monthLabel)}
        </p>
        <h1 className="mt-2 font-heading text-4xl tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          {t("subtitle")}
        </p>
      </header>

      {/* Coût du mois — typographie large, asymétrique, pas une carte */}
      <section className="mb-14 grid lg:grid-cols-[2fr_3fr] gap-x-12 gap-y-6 items-end border-b border-border pb-12">
        <dl>
          <dt className="text-xs text-muted-foreground uppercase tracking-wider">
            {t("estimatedThisMonth")}
          </dt>
          <dd className="mt-3 font-heading text-6xl md:text-7xl tracking-tight tabular-nums">
            {formatTotals(totalsMonth)}
          </dd>
        </dl>
        <dl className="grid grid-cols-3 gap-x-6 gap-y-2">
          <Metric
            label={t("inputTokens")}
            value={totalInputTokens.toLocaleString("fr-FR")}
          />
          <Metric
            label={t("outputTokens")}
            value={totalOutputTokens.toLocaleString("fr-FR")}
          />
          <Metric label={t("aiMessages")} value={messageCount.toString()} />
        </dl>
      </section>

      {quotaCents != null &&
        (() => {
          const pct =
            quotaCents > 0
              ? Math.min(100, Math.round((spentCentsMonth / quotaCents) * 100))
              : 0;
          const reached = spentCentsMonth >= quotaCents;
          const warning = !reached && pct >= 80;
          const fmt = (c: number) =>
            formatCost({ amount: c / 100, currency: "EUR" });
          return (
            <section className="mb-14 max-w-2xl border-b border-border pb-12">
              <div className="flex items-baseline justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t("monthlyCap")}
                </p>
                <p className="font-heading tabular-nums">
                  {fmt(spentCentsMonth)}{" "}
                  <span className="text-muted-foreground">
                    / {fmt(quotaCents)}
                  </span>
                </p>
              </div>
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={quotaCents}
                aria-valuenow={Math.min(spentCentsMonth, quotaCents)}
                aria-label={t("capProgressLabel")}
              >
                <div
                  className={`h-full rounded-full transition-all ${
                    reached
                      ? "bg-destructive"
                      : warning
                        ? "bg-warning"
                        : "bg-primary"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p
                className={`mt-2 text-xs ${
                  reached
                    ? "text-destructive"
                    : warning
                      ? "text-warning"
                      : "text-muted-foreground"
                }`}
              >
                {reached
                  ? t("capReached")
                  : warning
                    ? t("capApproaching", { pct })
                    : t("capDefined")}
              </p>
            </section>
          );
        })()}

      <section className="mb-14">
        <div className="grid lg:grid-cols-[280px_1fr] gap-x-12 gap-y-6">
          <h2 className="font-heading text-2xl tracking-tight">
            {t("perModelHeading")}
          </h2>
          <div>
            {modelRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 border-y border-dashed border-border">
                {t("noMessagesThisMonth")}
              </p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {modelRows.map((r) => (
                  <li key={r.modelId} className="py-3 grid grid-cols-[1fr_auto_auto_auto] gap-x-6 items-baseline">
                    <span className="font-mono text-xs truncate">
                      {r.modelId}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                      {t("msgUnit", { count: r.messages })}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                      {r.input.toLocaleString("fr-FR")}/{r.output.toLocaleString("fr-FR")}
                    </span>
                    <span className="font-heading tabular-nums">
                      {r.cost ? formatCost(r.cost) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="mb-14 grid lg:grid-cols-[280px_1fr] gap-x-12">
        <h2 className="font-heading text-2xl tracking-tight">
          {t("sinceSignupHeading")}
        </h2>
        <div className="flex items-baseline gap-x-8 gap-y-2 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {t("totalEstimated")}
            </p>
            <p className="mt-2 font-heading text-4xl tracking-tight tabular-nums">
              {formatTotals(totalsAllTime)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {t("messages")}
            </p>
            <p className="mt-2 font-heading text-4xl tracking-tight tabular-nums">
              {allTimeMessages.toLocaleString("fr-FR")}
            </p>
          </div>
        </div>
      </section>

      <section className="mb-14 grid lg:grid-cols-[280px_1fr] gap-x-12 gap-y-6">
        <div>
          <h2 className="font-heading text-2xl tracking-tight">
            {t("toolReliabilityHeading")}
          </h2>
          {toolStats.totalCalls > 0 && (
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              {t("toolCallsSummary", {
                count: toolStats.totalCalls,
                rate: Math.round(toolStats.successRate),
              })}
            </p>
          )}
        </div>
        <div>
          {toolStats.byTool.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 border-y border-dashed border-border">
              {t("noToolCalls")}
            </p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {toolStats.byTool.map((tool) => {
                const rate = Math.round(tool.successRate);
                const healthy = rate >= 95;
                const degraded = rate >= 80 && rate < 95;
                return (
                  <li
                    key={tool.toolName}
                    className="py-3 grid grid-cols-[1fr_auto_auto_auto] gap-x-6 items-baseline"
                  >
                    <span className="font-mono text-xs truncate">
                      {tool.toolName}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                      {t("callsCount", { count: tool.calls })}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatMs(tool.avgMs)}
                      <span className="opacity-60">
                        {" "}
                        / {formatMs(tool.maxMs)}
                      </span>
                    </span>
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        healthy
                          ? "text-success"
                          : degraded
                            ? "text-warning"
                            : "text-destructive"
                      }`}
                    >
                      {rate} %
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <aside className="mt-12 max-w-2xl border-l-2 border-primary/40 pl-4 text-sm text-muted-foreground">
        {t.rich("disclaimer", {
          strong: (chunks) => (
            <strong className="text-foreground">{chunks}</strong>
          ),
        })}
      </aside>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-heading text-xl tracking-tight tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
