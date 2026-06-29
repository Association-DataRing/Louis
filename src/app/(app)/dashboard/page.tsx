import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  IconArrowUpRight,
  IconKey,
  IconMessageCircle,
  IconFolder,
  IconFolders,
  IconCheck,
} from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  conversations,
  documents,
  messages,
  projects,
  providerKeys,
} from "@/db/schema";
import {
  aggregateCosts,
  formatCost,
  formatTotals,
} from "@/lib/providers/pricing";
import { getUserMonthlyQuotaCents } from "@/lib/usage/quota";
import { listEnabledModels } from "../settings/models/actions";
import { listActiveConnectorTypes } from "@/lib/connectors/runtime";
import { formatRelativeFr } from "@/lib/format/time";
import { ModuleHelp } from "@/components/module-help";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const t = await getTranslations("dashboard");
  const userId = session.user.id;
  const firstName = session?.user?.name?.split(/[\s.]/)[0] ?? "";

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    recentConvs,
    activeKeys,
    projectCount,
    docCount,
    monthRows,
    quotaCents,
    enabledModels,
    activeConnectors,
  ] = await Promise.all([
    db
      .select({
        id: conversations.id,
        title: conversations.title,
        updatedAt: conversations.updatedAt,
        projectId: conversations.projectId,
      })
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(5),
    db
      .select({ id: providerKeys.id })
      .from(providerKeys)
      .where(
        and(
          eq(providerKeys.userId, userId),
          eq(providerKeys.isActive, true)
        )
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(projects)
      .where(eq(projects.userId, userId))
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(documents)
      .where(eq(documents.userId, userId))
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
          eq(conversations.userId, userId),
          eq(messages.role, "assistant"),
          gte(messages.createdAt, monthStart)
        )
      ),
    getUserMonthlyQuotaCents(userId),
    listEnabledModels(userId),
    listActiveConnectorTypes(userId),
  ]);

  const monthCost = aggregateCosts(monthRows);
  const hasProvider = activeKeys.length > 0;
  const hasModel = enabledModels.length > 0;
  const hasConnector = activeConnectors.length > 0;
  const hasContent = recentConvs.length > 0;

  // H22 : rendre le plafond mensuel visible au membre (jusqu'ici réservé à
  // l'admin). Même dépense que l'enforcement → pas de surprise « bloqué ».
  const spentCentsMonth = Math.round((monthCost.EUR + monthCost.USD) * 100);
  const quotaPct =
    quotaCents != null && quotaCents > 0
      ? Math.min(100, Math.round((spentCentsMonth / quotaCents) * 100))
      : 0;
  const quotaReached = quotaCents != null && spentCentsMonth >= quotaCents;
  const monthHint =
    quotaCents != null
      ? `${formatCost({ amount: spentCentsMonth / 100, currency: "EUR" })} / ${formatCost({ amount: quotaCents / 100, currency: "EUR" })}${quotaReached ? ` — ${t("month.capReached")}` : quotaPct >= 80 ? ` — ${t("month.percent", { pct: quotaPct })}` : ""}`
      : t("month.costEstimated");
  const monthHintTone: "default" | "warning" | "danger" = quotaReached
    ? "danger"
    : quotaCents != null && quotaPct >= 80
      ? "warning"
      : "default";

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-8 md:py-14">
      <header className="mb-12">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          {t("eyebrow")}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="font-heading text-4xl md:text-5xl tracking-tight">
            {firstName ? t("greetingNamed", { name: firstName }) : t("greeting")}
          </h1>
          <ModuleHelp
            slug="user/getting-started"
            title={t("gettingStartedTitle")}
          >
            {t("gettingStartedBody")}
          </ModuleHelp>
        </div>
      </header>

      {(!hasProvider || !hasModel) && (
        <ReadinessChecklist
          hasProvider={hasProvider}
          hasModel={hasModel}
          hasConnector={hasConnector}
        />
      )}

      {/* Stats inline en grande typographie, pas une grille de cartes */}
      <section className="mb-14 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-6 border-b border-border pb-12">
        <Stat
          label={t("stats.thisMonth")}
          value={formatTotals(monthCost)}
          hint={monthHint}
          hintTone={monthHintTone}
          href="/settings/usage"
        />
        <Stat
          label={t("stats.projects")}
          value={projectCount.toString()}
          href="/projects"
        />
        <Stat
          label={t("stats.documents")}
          value={docCount.toString()}
          href="/documents"
        />
        <Stat
          label={t("stats.activeProviders")}
          value={activeKeys.length.toString()}
          href="/settings/providers"
        />
      </section>

      {/* Récent — pas une grille, une liste */}
      <section className="grid lg:grid-cols-[280px_1fr] gap-12">
        <div>
          <h2 className="font-heading text-2xl tracking-tight">
            {t("recent.title")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("recent.subtitle")}
          </p>
        </div>
        {hasContent ? (
          <ul className="divide-y divide-border">
            {recentConvs.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/chat?id=${c.id}`}
                  className="group flex items-start justify-between gap-4 py-4 hover:text-primary transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatRelativeFr(c.updatedAt)}
                      {c.projectId && ` · ${t("recent.inProject")}`}
                    </p>
                  </div>
                  <IconArrowUpRight className="size-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                </Link>
              </li>
            ))}
            <li className="pt-4">
              <Link
                href="/chat"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-2"
              >
                {t("recent.newConversation")}
                <IconArrowUpRight className="size-3.5" />
              </Link>
            </li>
          </ul>
        ) : (
          <FirstSteps />
        )}
      </section>
    </main>
  );
}

/**
 * R9' : checklist de mise en route STATEFUL (et non plus basée sur le nombre
 * de conversations). Reflète l'état réel : provider actif → modèle activé →
 * connecteur (optionnel) → chat. Reste affichée tant que provider OU modèle
 * manque ; disparaît une fois les deux présents.
 */
async function ReadinessChecklist({
  hasProvider,
  hasModel,
  hasConnector,
}: {
  hasProvider: boolean;
  hasModel: boolean;
  hasConnector: boolean;
}) {
  const t = await getTranslations("dashboard");
  const steps = [
    {
      done: hasProvider,
      label: t("readiness.stepProvider"),
      href: "/settings/providers",
      hint: t("readiness.stepProviderHint"),
    },
    {
      done: hasModel,
      label: t("readiness.stepModel"),
      href: "/settings/models/library",
      hint: t("readiness.stepModelHint"),
    },
    {
      done: hasConnector,
      label: t("readiness.stepConnector"),
      href: "/settings/connectors",
      hint: t("readiness.stepConnectorHint"),
      optional: true,
    },
  ];
  const ready = hasProvider && hasModel;

  return (
    <div className="mb-10 rounded-lg border border-primary/30 bg-primary/5 px-5 py-4">
      <div className="flex items-start gap-3">
        <IconKey className="size-5 shrink-0 text-primary mt-0.5" />
        <div className="flex-1">
          <p className="font-medium">{t("readiness.heading")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("readiness.subtitle")}
          </p>
          <ol className="mt-4 space-y-2.5">
            {steps.map((s, i) => (
              <li key={s.href} className="flex items-center gap-2.5 text-sm">
                {s.done ? (
                  <span className="size-5 shrink-0 grid place-items-center rounded-full bg-success/15 text-success">
                    <IconCheck className="size-3.5" />
                  </span>
                ) : (
                  <span className="size-5 shrink-0 grid place-items-center rounded-full border border-border text-[11px] tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                )}
                <Link
                  href={s.href}
                  className={
                    s.done
                      ? "text-muted-foreground line-through"
                      : "font-medium hover:text-primary"
                  }
                >
                  {s.label}
                </Link>
                {s.optional && !s.done && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("readiness.optional")}
                  </span>
                )}
                {!s.done && (
                  <span className="hidden sm:inline text-xs text-muted-foreground">
                    — {s.hint}
                  </span>
                )}
              </li>
            ))}
            <li className="flex items-center gap-2.5 text-sm">
              <span className="size-5 shrink-0 grid place-items-center rounded-full border border-border">
                <IconMessageCircle className="size-3 text-muted-foreground" />
              </span>
              <Link
                href="/chat"
                aria-disabled={!ready}
                className={
                  ready
                    ? "font-medium hover:text-primary"
                    : "text-muted-foreground pointer-events-none"
                }
              >
                {t("readiness.startConversation")}
              </Link>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

/**
 * Premiers pas côté contenu (documents, projets, conversation). La connexion
 * du provider n'apparaît PAS ici : elle est déjà portée par le bandeau
 * « Mise en route » et la carte « Prise en main » de la sidebar — trois
 * rappels identiques sur un même écran seraient du bruit.
 */
async function FirstSteps() {
  const t = await getTranslations("dashboard");
  return (
    <ol className="space-y-5 text-sm">
      <li className="flex gap-3">
        <span className="font-heading text-muted-foreground tabular-nums shrink-0 w-6">
          01
        </span>
        <Link href="/documents" className="hover:text-primary inline-flex items-center gap-1.5">
          <IconFolder className="size-3.5" />
          {t("firstSteps.importDocument")}
        </Link>
      </li>
      <li className="flex gap-3">
        <span className="font-heading text-muted-foreground tabular-nums shrink-0 w-6">
          02
        </span>
        <Link href="/projects" className="hover:text-primary inline-flex items-center gap-1.5">
          <IconFolders className="size-3.5" />
          {t("firstSteps.createProject")}
        </Link>
      </li>
      <li className="flex gap-3">
        <span className="font-heading text-muted-foreground tabular-nums shrink-0 w-6">
          03
        </span>
        <Link href="/chat" className="hover:text-primary inline-flex items-center gap-1.5">
          <IconMessageCircle className="size-3.5" />
          {t("firstSteps.startConversation")}
        </Link>
      </li>
    </ol>
  );
}

function Stat({
  label,
  value,
  hint,
  hintTone = "default",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: "default" | "warning" | "danger";
  href?: string;
}) {
  const hintClass =
    hintTone === "danger"
      ? "text-destructive"
      : hintTone === "warning"
        ? "text-warning"
        : "text-muted-foreground";
  const inner = (
    <dl>
      <dt className="text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </dt>
      <dd className="mt-2 font-heading text-3xl tracking-tight tabular-nums">
        {value}
      </dd>
      {hint && (
        <dd className={`mt-0.5 text-xs tabular-nums ${hintClass}`}>{hint}</dd>
      )}
    </dl>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="group block hover:text-primary transition-colors"
      >
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

