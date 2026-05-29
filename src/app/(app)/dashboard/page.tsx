import { redirect } from "next/navigation";
import Link from "next/link";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  IconArrowUpRight,
  IconKey,
  IconMessageCircle,
  IconFolder,
  IconFolders,
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
  formatTotals,
} from "@/lib/providers/pricing";
import { ModuleHelp } from "@/components/module-help";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
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
  ]);

  const monthCost = aggregateCosts(monthRows);
  const hasProvider = activeKeys.length > 0;
  const hasContent = recentConvs.length > 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-8 md:py-14">
      <header className="mb-12">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          Tableau de bord
        </p>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="font-heading text-4xl md:text-5xl tracking-tight">
            Bonjour{firstName ? `, ${firstName}` : ""}.
          </h1>
          <ModuleHelp slug="user/getting-started" title="Prise en main">
            Nouveau sur Louis ? Le parcours de mise en route en 5 étapes :
            connecter une clé provider, vos sources juridiques, puis lancer
            votre première conversation.
          </ModuleHelp>
        </div>
      </header>

      {!hasProvider && <SetupBanner />}

      {/* Stats inline en grande typographie, pas une grille de cartes */}
      <section className="mb-14 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-6 border-b border-border pb-12">
        <Stat
          label="Ce mois"
          value={formatTotals(monthCost)}
          hint="coût estimé"
        />
        <Stat
          label="Projets"
          value={projectCount.toString()}
          href="/projects"
        />
        <Stat
          label="Documents"
          value={docCount.toString()}
          href="/documents"
        />
        <Stat
          label="Providers actifs"
          value={activeKeys.length.toString()}
          href="/settings/providers"
        />
      </section>

      {/* Récent — pas une grille, une liste */}
      <section className="grid lg:grid-cols-[280px_1fr] gap-12">
        <div>
          <h2 className="font-heading text-2xl tracking-tight">
            Reprendre.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Vos cinq dernières conversations. Cliquez pour reprendre où vous
            étiez.
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
                      {timeAgo(c.updatedAt)}
                      {c.projectId && " · dans un projet"}
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
                Nouvelle conversation
                <IconArrowUpRight className="size-3.5" />
              </Link>
            </li>
          </ul>
        ) : (
          <FirstSteps hasProvider={hasProvider} />
        )}
      </section>
    </main>
  );
}

function SetupBanner() {
  return (
    <div className="mb-10 rounded-lg border border-primary/30 bg-primary/5 px-5 py-4 flex items-start gap-3">
      <IconKey className="size-5 shrink-0 text-primary mt-0.5" />
      <div className="flex-1">
        <p className="font-medium">
          Ajoutez une première clé pour démarrer.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Sans clé provider active, le chat ne peut pas répondre. Configurez
          Mistral, Scaleway, OVH, Albert, ou tout autre endpoint compatible.
        </p>
        <Link
          href="/settings/providers"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-2"
        >
          Ouvrir Providers
          <IconArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function FirstSteps({ hasProvider }: { hasProvider: boolean }) {
  return (
    <ol className="space-y-5 text-sm">
      {!hasProvider && (
        <li className="flex gap-3">
          <span className="font-heading text-muted-foreground tabular-nums shrink-0 w-6">
            01
          </span>
          <Link href="/settings/providers" className="hover:text-primary">
            Configurer un provider IA
            <span className="ml-1 text-muted-foreground">→ /providers</span>
          </Link>
        </li>
      )}
      <li className="flex gap-3">
        <span className="font-heading text-muted-foreground tabular-nums shrink-0 w-6">
          {hasProvider ? "01" : "02"}
        </span>
        <Link href="/documents" className="hover:text-primary inline-flex items-center gap-1.5">
          <IconFolder className="size-3.5" />
          Importer un premier document
        </Link>
      </li>
      <li className="flex gap-3">
        <span className="font-heading text-muted-foreground tabular-nums shrink-0 w-6">
          {hasProvider ? "02" : "03"}
        </span>
        <Link href="/projects" className="hover:text-primary inline-flex items-center gap-1.5">
          <IconFolders className="size-3.5" />
          Créer un projet pour un dossier client
        </Link>
      </li>
      <li className="flex gap-3">
        <span className="font-heading text-muted-foreground tabular-nums shrink-0 w-6">
          {hasProvider ? "03" : "04"}
        </span>
        <Link href="/chat" className="hover:text-primary inline-flex items-center gap-1.5">
          <IconMessageCircle className="size-3.5" />
          Lancer une première conversation
        </Link>
      </li>
    </ol>
  );
}

function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-2 font-heading text-3xl tracking-tight tabular-nums">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      )}
    </>
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

function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `il y a ${days} j`;
  return d.toLocaleDateString("fr-FR");
}
