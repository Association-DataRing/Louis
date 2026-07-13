import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { IconArrowRight, IconBuildingBank } from "@tabler/icons-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { providerKeys } from "@/db/schema";
import { listPipelines } from "./actions";
import { roleMeta } from "./agent-role-meta";
import { modeMeta } from "./mode-meta";
import { PipelineActionsMenu } from "./pipeline-actions-menu";
import { TryPipelineButton } from "./try-pipeline-button";
import { ReloadButton } from "./reload-button";

export default async function BureauPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const t = await getTranslations("board");

  const [list, keys] = await Promise.all([
    listPipelines(),
    db
      .select({ id: providerKeys.id })
      .from(providerKeys)
      .where(eq(providerKeys.userId, userId))
      .orderBy(asc(providerKeys.label)),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-8 md:py-14">
      <header className="mb-10 flex items-end justify-between gap-4 flex-wrap">
        <div className="max-w-2xl">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {t("home.eyebrow")}
          </p>
          <h1 className="mt-2 font-heading text-4xl tracking-tight">
            {t("home.title")}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {t("home.subtitle")}
          </p>
        </div>
      </header>

      {keys.length === 0 ? (
        <EmptyKeysState />
      ) : list.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map(({ pipeline, agents }) => {
            const mMeta = modeMeta(pipeline.mode);
            const ModeIcon = mMeta.icon;
            return (
              <div
                key={pipeline.id}
                className="group relative rounded-2xl border border-border bg-card/50 hover:bg-card hover:border-foreground/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-5 focus-within:border-foreground/30"
              >
                {/* Lien étiré : la carte entière est cliquable sans imbriquer
                    de boutons dans un <a> (HTML invalide + casse le clavier).
                    Les contrôles (menu, « Essayer ») passent au-dessus via
                    z-10. */}
                <Link
                  href={`/board/${pipeline.id}`}
                  className="absolute inset-0 z-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t("home.openPipeline", { name: pipeline.name })}
                >
                  <span className="sr-only">
                    {t("home.openPipeline", { name: pipeline.name })}
                  </span>
                </Link>
                <div className="relative flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-foreground/70 uppercase tracking-wider">
                        {pipeline.isPreset ? t("home.preset") : t("home.pipelineCabinet")}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-foreground/70">
                        <ModeIcon className="size-3" />
                        {t(mMeta.labelKey)}
                        {pipeline.mode === "council" && pipeline.rounds > 1 && (
                          <span className="opacity-70">
                            · {t("home.roundsCount", { count: pipeline.rounds })}
                          </span>
                        )}
                      </span>
                    </div>
                    <h2
                      className="mt-1 font-heading text-xl tracking-tight"
                      title={t("home.slugTitle", { slug: pipeline.slug })}
                    >
                      {pipeline.name}
                    </h2>
                  </div>
                  <span className="relative z-10">
                    <PipelineActionsMenu pipeline={pipeline} />
                  </span>
                </div>

                {pipeline.description && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                    {pipeline.description}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-1.5 flex-wrap">
                  {agents.map((a, i) => {
                    const meta = roleMeta(a.role);
                    const Icon = meta.icon;
                    const isFinal = i === agents.length - 1;
                    return (
                      <div
                        key={a.id}
                        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] ${
                          isFinal
                            ? "border-foreground/30 bg-foreground/5"
                            : "border-border bg-background"
                        }`}
                        title={a.label}
                      >
                        <Icon className="size-3 shrink-0" />
                        <span className="truncate max-w-[140px]">{a.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="relative mt-5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {t("home.agentsCount", { count: agents.length })}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="relative z-10">
                      <TryPipelineButton
                        pipelineId={pipeline.id}
                        slug={pipeline.slug}
                        mode={pipeline.mode}
                        agentCount={agents.length}
                        rounds={pipeline.rounds}
                      />
                    </span>
                    <span
                      aria-hidden
                      className="w-px h-3 bg-border self-center"
                    />
                    <span className="inline-flex items-center gap-1 text-foreground group-hover:gap-2 transition-all">
                      {t("home.open")}
                      <IconArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

async function EmptyState() {
  const t = await getTranslations("board");
  return (
    <div className="py-16 border-y border-dashed border-border">
      <p className="font-heading text-2xl tracking-tight">
        {t("home.emptyTitle")}
      </p>
      <p className="mt-3 text-sm text-muted-foreground max-w-md">
        {t("home.emptyBody")}
      </p>
      <div className="mt-5">
        <ReloadButton />
      </div>
    </div>
  );
}

async function EmptyKeysState() {
  const t = await getTranslations("board");
  return (
    <div className="py-12 border-y border-dashed border-border flex items-start gap-4">
      <IconBuildingBank className="size-6 mt-1 text-muted-foreground shrink-0" />
      <div>
        <p className="font-heading text-xl tracking-tight">
          {t("home.emptyKeysTitle")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          {t.rich("home.emptyKeysBody", {
            link: (chunks) => (
              <Link
                href="/settings/providers"
                className="underline underline-offset-2"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </div>
  );
}
