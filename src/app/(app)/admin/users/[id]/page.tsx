import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  IconArrowLeft,
  IconShield,
  IconMessageCircle,
  IconFolder,
  IconFolders,
  IconCoin,
} from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  users,
  conversations,
  documents,
  projects,
  messages,
  auditLog,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth/permissions";
import { aggregateCosts, formatTotals } from "@/lib/providers/pricing";
import { labelForAction } from "@/lib/audit/labels";
import { Badge } from "@/components/ui/badge";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const t = await getTranslations("admin.users");
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!user) notFound();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [convCount, docCount, projectCount, monthRows, recentConvs, recentAudit] =
    await Promise.all([
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(conversations)
        .where(eq(conversations.userId, id))
        .then((r) => r[0]?.n ?? 0),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(documents)
        .where(eq(documents.userId, id))
        .then((r) => r[0]?.n ?? 0),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(projects)
        .where(eq(projects.userId, id))
        .then((r) => r[0]?.n ?? 0),
      db
        .select({
          modelId: messages.modelId,
          inputTokens: messages.inputTokens,
          outputTokens: messages.outputTokens,
        })
        .from(messages)
        .innerJoin(conversations, eq(conversations.id, messages.conversationId))
        .where(
          and(
            eq(conversations.userId, id),
            eq(messages.role, "assistant"),
            gte(messages.createdAt, monthStart)
          )
        ),
      db
        .select({
          id: conversations.id,
          title: conversations.title,
          updatedAt: conversations.updatedAt,
        })
        .from(conversations)
        .where(eq(conversations.userId, id))
        .orderBy(desc(conversations.updatedAt))
        .limit(5),
      db
        .select({
          id: auditLog.id,
          action: auditLog.action,
          target: auditLog.target,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .where(eq(auditLog.userId, id))
        .orderBy(desc(auditLog.createdAt))
        .limit(15),
    ]);

  const monthCost = aggregateCosts(monthRows);
  const monthCostCents = Math.round((monthCost.EUR + monthCost.USD) * 100);
  const quotaCents = user.monthlyQuotaCents;
  const quotaPercent =
    quotaCents != null && quotaCents > 0
      ? Math.min(100, Math.round((monthCostCents / quotaCents) * 100))
      : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8 md:px-8 md:py-10">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <IconArrowLeft className="size-3.5" />
        {t("backToUsers")}
      </Link>

      <header className="mb-8 flex items-start gap-4">
        <div className="size-12 shrink-0 rounded-full bg-muted flex items-center justify-center text-foreground font-medium">
          {user.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-heading text-3xl tracking-tight">
              {user.name}
            </h1>
            {user.role === "admin" && (
              <Badge variant="default" className="gap-1">
                <IconShield className="size-3" />
                {t("badgeAdmin")}
              </Badge>
            )}
            {!user.isActive && (
              <Badge variant="outline">{t("badgeDisabled")}</Badge>
            )}
          </div>
          <p className="mt-1 text-muted-foreground">{user.email}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("createdOn", {
              date: new Date(user.createdAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
            })}
            {user.lastLogin && (
              <>
                {" · "}
                {t("lastLoginOn", {
                  date: new Date(user.lastLogin).toLocaleDateString("fr-FR"),
                })}
              </>
            )}
          </p>
        </div>
      </header>

      {/* Stats grand format en grille — typo magazine, pas de carte. */}
      <section className="mb-12 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 border-y border-border py-6">
        <StatBlock
          icon={IconMessageCircle}
          label={t("detailStatConversations")}
          value={convCount.toString()}
        />
        <StatBlock
          icon={IconFolder}
          label={t("detailStatDocuments")}
          value={docCount.toString()}
        />
        <StatBlock
          icon={IconFolders}
          label={t("detailStatProjects")}
          value={projectCount.toString()}
        />
        <StatBlock
          icon={IconCoin}
          label={t("detailStatMonthCost")}
          value={formatTotals(monthCost)}
        />
      </section>

      {/* Quota — affiché seulement si défini, avec progression visuelle. */}
      {quotaCents != null && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-heading text-lg tracking-tight">
              {t("monthlyQuota")}
            </h2>
            <p className="text-sm tabular-nums">
              {(monthCostCents / 100).toFixed(2).replace(".", ",")} €{" "}
              <span className="text-muted-foreground">
                / {(quotaCents / 100).toFixed(2).replace(".", ",")} €
              </span>
            </p>
          </div>
          <div
            className="h-2 w-full rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-label={t("quotaAria")}
            aria-valuenow={monthCostCents}
            aria-valuemin={0}
            aria-valuemax={quotaCents ?? undefined}
          >
            <div
              className={`h-full transition-all ${
                quotaPercent! >= 100
                  ? "bg-destructive"
                  : quotaPercent! >= 80
                    ? "bg-warning"
                    : "bg-foreground/70"
              }`}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
          {quotaPercent! >= 100 && (
            <p className="mt-2 text-xs text-destructive">
              {t("quotaExceeded")}
            </p>
          )}
        </section>
      )}

      <section className="grid lg:grid-cols-2 gap-10 mb-10">
        <div>
          <h2 className="font-heading text-lg tracking-tight mb-3">
            {t("recentConversations")}
          </h2>
          {recentConvs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noConversations")}
            </p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {recentConvs.map((c) => (
                <li
                  key={c.id}
                  className="py-3 flex items-start justify-between gap-3"
                >
                  <span className="text-sm truncate flex-1">{c.title}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                    {new Date(c.updatedAt).toLocaleDateString("fr-FR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="font-heading text-lg tracking-tight mb-3">
            {t("activityLog")}
          </h2>
          {recentAudit.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noEvents")}
            </p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {recentAudit.map((a) => (
                <li
                  key={a.id}
                  className="py-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{labelForAction(a.action)}</p>
                    {a.target && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {a.target}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                    {new Date(a.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function StatBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </div>
      <p className="mt-1.5 font-heading text-3xl tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  );
}
