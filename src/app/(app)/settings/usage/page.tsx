import { redirect } from "next/navigation";
import { and, eq, gte, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import {
  aggregateCosts,
  computeCost,
  formatCost,
  formatTotals,
} from "@/lib/providers/pricing";

export default async function UsagePage() {
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
    const key = r.modelId ?? "(non spécifié)";
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

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-8 md:py-14">
      <header className="mb-12">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          {capitalize(monthLabel)}
        </p>
        <h1 className="mt-2 font-heading text-4xl tracking-tight">
          Coûts &amp; usage.
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          Estimation selon les tarifs publics. Les valeurs réelles peuvent
          varier (remises négociées, changements de tarification).
        </p>
      </header>

      {/* Coût du mois — typographie large, asymétrique, pas une carte */}
      <section className="mb-14 grid lg:grid-cols-[2fr_3fr] gap-x-12 gap-y-6 items-end border-b border-border pb-12">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Coût estimé ce mois
          </p>
          <p className="mt-3 font-heading text-6xl md:text-7xl tracking-tight tabular-nums">
            {formatTotals(totalsMonth)}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-x-6 gap-y-2">
          <Metric
            label="Tokens entrée"
            value={totalInputTokens.toLocaleString("fr-FR")}
          />
          <Metric
            label="Tokens sortie"
            value={totalOutputTokens.toLocaleString("fr-FR")}
          />
          <Metric label="Messages IA" value={messageCount.toString()} />
        </dl>
      </section>

      <section className="mb-14">
        <div className="grid lg:grid-cols-[280px_1fr] gap-x-12 gap-y-6">
          <h2 className="font-heading text-2xl tracking-tight">
            Détail par modèle.
          </h2>
          <div>
            {modelRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 border-y border-dashed border-border">
                Aucun message IA ce mois-ci.
              </p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {modelRows.map((r) => (
                  <li key={r.modelId} className="py-3 grid grid-cols-[1fr_auto_auto_auto] gap-x-6 items-baseline">
                    <span className="font-mono text-xs truncate">
                      {r.modelId}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                      {r.messages} msg
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
          Depuis votre inscription.
        </h2>
        <div className="flex items-baseline gap-x-8 gap-y-2 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Total estimé
            </p>
            <p className="mt-2 font-heading text-4xl tracking-tight tabular-nums">
              {formatTotals(totalsAllTime)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Messages
            </p>
            <p className="mt-2 font-heading text-4xl tracking-tight tabular-nums">
              {allTimeMessages.toLocaleString("fr-FR")}
            </p>
          </div>
        </div>
      </section>

      <aside className="mt-12 max-w-2xl border-l-2 border-primary/40 pl-4 text-sm text-muted-foreground">
        Les coûts utilisent les grilles publiques des providers (mai 2026).
        Pour les modèles auto-hébergés (Ollama, vLLM, Albert d&apos;Etalab),
        le coût affiché est <strong className="text-foreground">0</strong>{" "}
        — vous payez l&apos;infrastructure ailleurs.
      </aside>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
