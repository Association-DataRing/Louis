import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { IconUsers, IconFileText, IconMessageCircle } from "@tabler/icons-react";
import { db } from "@/db";
import {
  conversations,
  documents,
  messages,
  projects,
  users,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth/permissions";
import {
  aggregateCosts,
  formatTotals,
  computeCost,
  formatCost,
} from "@/lib/providers/pricing";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const t = await getTranslations("admin.overview");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    userCount,
    activeUserCount,
    docCount,
    convCount,
    projectCount,
    monthRows,
    topUsersRows,
  ] = await Promise.all([
    db.select({ n: count() }).from(users).then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(users)
      .where(eq(users.isActive, true))
      .then((r) => r[0]?.n ?? 0),
    db.select({ n: count() }).from(documents).then((r) => r[0]?.n ?? 0),
    db.select({ n: count() }).from(conversations).then((r) => r[0]?.n ?? 0),
    db.select({ n: count() }).from(projects).then((r) => r[0]?.n ?? 0),
    // Tokens du mois courant pour le coût agrégé cabinet
    db
      .select({
        modelId: messages.modelId,
        inputTokens: messages.inputTokens,
        outputTokens: messages.outputTokens,
      })
      .from(messages)
      .where(
        and(eq(messages.role, "assistant"), gte(messages.createdAt, monthStart))
      ),
    // Top 5 utilisateurs par coût ce mois
    db
      .select({
        userId: conversations.userId,
        email: users.email,
        name: users.name,
        msgCount: sql<number>`COUNT(*)::int`,
        inputTokens: sql<number>`COALESCE(SUM(${messages.inputTokens}), 0)::int`,
        outputTokens: sql<number>`COALESCE(SUM(${messages.outputTokens}), 0)::int`,
      })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .innerJoin(users, eq(users.id, conversations.userId))
      .where(
        and(eq(messages.role, "assistant"), gte(messages.createdAt, monthStart))
      )
      .groupBy(conversations.userId, users.email, users.name)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(5),
  ]);

  const monthTotals = aggregateCosts(monthRows);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-8 md:py-12">
      <header className="mb-10">
        <h1 className="font-heading text-3xl tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          {t("subtitle")}
        </p>
      </header>

      <section className="mb-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 border-b border-border pb-12">
        <Stat
          label={t("statMonthCost")}
          value={formatTotals(monthTotals)}
          highlight
        />
        <Stat
          label={t("statActiveUsers")}
          value={`${activeUserCount} / ${userCount}`}
          icon={IconUsers}
        />
        <Stat
          label={t("statDocuments")}
          value={docCount.toLocaleString("fr-FR")}
          icon={IconFileText}
        />
        <Stat
          label={t("statConversations")}
          value={convCount.toLocaleString("fr-FR")}
          icon={IconMessageCircle}
          hint={t("projectsHint", { count: projectCount })}
        />
      </section>

      <section className="grid lg:grid-cols-[280px_1fr] gap-x-12 gap-y-6">
        <h2 className="font-heading text-2xl tracking-tight">
          {t("topUsers")}
        </h2>
        <div>
          {topUsersRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 border-y border-dashed border-border">
              {t("noActivity")}
            </p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {topUsersRows.map((u) => {
                const cost = computeCost(
                  null,
                  u.inputTokens ?? 0,
                  u.outputTokens ?? 0
                );
                return (
                  <li
                    key={u.userId}
                    className="py-3 grid grid-cols-[1fr_auto_auto] gap-x-6 items-baseline"
                  >
                    <span className="text-sm truncate">
                      <span className="font-medium">{u.name}</span>
                      <span className="text-muted-foreground ml-2">
                        {u.email}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t("msgCount", { count: u.msgCount })}
                    </span>
                    <span className="font-heading tabular-nums text-sm">
                      {cost ? formatCost(cost) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <aside className="mt-12 max-w-2xl border-l-2 border-primary/40 pl-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">{t("noteHeading")}</p>
        <p>{t("noteBody")}</p>
      </aside>
    </main>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  icon?: typeof IconUsers;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider inline-flex items-center gap-1.5">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </p>
      <p
        className={`mt-2 font-heading tracking-tight tabular-nums ${
          highlight ? "text-3xl" : "text-2xl"
        }`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
