import Link from "next/link";
import { asc, eq } from "drizzle-orm";
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

export default async function BureauPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

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
            Bureau
          </p>
          <h1 className="mt-2 font-heading text-4xl tracking-tight">
            Votre cabinet d&apos;IA.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Chaque pipeline est une équipe d&apos;agents. Ouvrez-la pour voir
            son organigramme, modifier chaque rôle, choisir le modèle et le
            prompt système.
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
              <Link
                key={pipeline.id}
                href={`/board/${pipeline.id}`}
                className="group block rounded-2xl border border-border bg-card/50 hover:bg-card hover:border-foreground/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-foreground/70 uppercase tracking-wider">
                        {pipeline.isPreset ? "Preset" : "Pipeline cabinet"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-foreground/70">
                        <ModeIcon className="size-3" />
                        {mMeta.label}
                        {pipeline.mode === "council" && pipeline.rounds > 1 && (
                          <span className="opacity-70">
                            · {pipeline.rounds} tours
                          </span>
                        )}
                      </span>
                    </div>
                    <h2
                      className="mt-1 font-heading text-xl tracking-tight"
                      title={`slug: ${pipeline.slug}`}
                    >
                      {pipeline.name}
                    </h2>
                  </div>
                  <PipelineActionsMenu pipeline={pipeline} />
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
                        <Icon className="size-3" />
                        <span className="truncate max-w-[70px]">{a.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {agents.length} agent{agents.length > 1 ? "s" : ""}
                  </span>
                  <div className="flex items-center gap-3">
                    <TryPipelineButton
                      pipelineId={pipeline.id}
                      slug={pipeline.slug}
                      mode={pipeline.mode}
                      agentCount={agents.length}
                      rounds={pipeline.rounds}
                    />
                    <span
                      aria-hidden
                      className="w-px h-3 bg-border self-center"
                    />
                    <span className="inline-flex items-center gap-1 text-foreground group-hover:gap-2 transition-all">
                      Ouvrir
                      <IconArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="py-16 border-y border-dashed border-border">
      <p className="font-heading text-2xl tracking-tight">
        Pas encore de pipeline.
      </p>
      <p className="mt-3 text-sm text-muted-foreground max-w-md">
        Les pipelines presets sont semés au premier chargement. Rechargez la
        page si rien n&apos;apparaît.
      </p>
    </div>
  );
}

function EmptyKeysState() {
  return (
    <div className="py-12 border-y border-dashed border-border flex items-start gap-4">
      <IconBuildingBank className="size-6 mt-1 text-muted-foreground shrink-0" />
      <div>
        <p className="font-heading text-xl tracking-tight">
          Configurez d&apos;abord une clé provider.
        </p>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          Le board orchestre des agents qui appellent des modèles via vos
          clés. Rendez-vous dans{" "}
          <Link
            href="/settings/providers"
            className="underline underline-offset-2"
          >
            Réglages › Providers
          </Link>{" "}
          pour en ajouter une.
        </p>
      </div>
    </div>
  );
}
