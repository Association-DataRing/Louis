import { and, eq, gte, sql } from "drizzle-orm";
import {
  IconCash,
  IconCalendar,
  IconInfoCircle,
  IconCpu,
} from "@tabler/icons-react";
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
  const userId = session!.user.id;

  // Période : début du mois courant
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthLabel = now.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  // Tous les messages assistant du mois — on agrège côté serveur après
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

  // Stats globales du mois
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

  // Agrégation par modèle pour le tableau détaillé
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
      // Tri par coût desc puis par messages desc
      const ca = a.cost?.amount ?? 0;
      const cb = b.cost?.amount ?? 0;
      if (cb !== ca) return cb - ca;
      return b.messages - a.messages;
    });

  // Totaux all-time
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
    <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-8">
        <h1 className="font-heading text-3xl tracking-tight">Coûts & usage</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Estimation de votre consommation selon les tarifs publics des
          providers. Les valeurs réelles peuvent varier (remises négociées,
          changements de tarification).
        </p>
      </header>

      {/* Stats du mois */}
      <section className="mb-10">
        <h2 className="font-heading text-lg tracking-tight mb-3 inline-flex items-center gap-2">
          <IconCalendar className="size-4 text-muted-foreground" />
          {capitalize(monthLabel)}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={IconCash}
            label="Coût estimé"
            value={formatTotals(totalsMonth)}
            highlight
          />
          <StatCard
            icon={IconCpu}
            label="Tokens entrée"
            value={totalInputTokens.toLocaleString("fr-FR")}
          />
          <StatCard
            icon={IconCpu}
            label="Tokens sortie"
            value={totalOutputTokens.toLocaleString("fr-FR")}
          />
          <StatCard
            icon={IconInfoCircle}
            label="Messages IA"
            value={messageCount.toString()}
          />
        </div>
      </section>

      {/* Détail par modèle */}
      <section className="mb-10">
        <h2 className="font-heading text-lg tracking-tight mb-3">
          Détail par modèle
        </h2>
        {modelRows.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-10 text-center text-sm text-muted-foreground">
            Aucun message IA ce mois-ci.
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5 border-b border-border">
                      Modèle
                    </th>
                    <th className="text-right font-medium px-4 py-2.5 border-b border-border">
                      Messages
                    </th>
                    <th className="text-right font-medium px-4 py-2.5 border-b border-border">
                      Tokens entrée
                    </th>
                    <th className="text-right font-medium px-4 py-2.5 border-b border-border">
                      Tokens sortie
                    </th>
                    <th className="text-right font-medium px-4 py-2.5 border-b border-border">
                      Coût estimé
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {modelRows.map((r) => (
                    <tr
                      key={r.modelId}
                      className="border-b border-border last:border-0 hover:bg-accent/20"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs truncate max-w-[280px]">
                        {r.modelId}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {r.messages}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {r.input.toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {r.output.toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        {r.cost ? formatCost(r.cost) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Total all-time */}
      <section className="mb-10">
        <h2 className="font-heading text-lg tracking-tight mb-3">
          Depuis votre inscription
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StatCard
            icon={IconCash}
            label="Total estimé"
            value={formatTotals(totalsAllTime)}
            highlight
          />
          <StatCard
            icon={IconInfoCircle}
            label="Total messages"
            value={allTimeMessages.toString()}
          />
        </div>
      </section>

      <aside className="mt-12 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">À noter :</strong> les coûts sont
        calculés à partir des grilles publiques des providers (mai 2026). Pour
        les modèles auto-hébergés (Ollama, vLLM, Albert d&apos;Etalab pour le
        secteur public), le coût affiché est <strong>0</strong> — vous payez
        l&apos;infrastructure ailleurs.
      </aside>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof IconCash;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border border-border rounded-lg p-4 ${
        highlight ? "bg-primary/5 border-primary/20" : "bg-card"
      }`}
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div
        className={`font-heading tracking-tight mt-1 tabular-nums ${
          highlight ? "text-2xl text-foreground" : "text-xl"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
