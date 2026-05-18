import { asc, eq } from "drizzle-orm";
import { IconBuildingBank } from "@tabler/icons-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { providerKeys } from "@/db/schema";
import { listPipelines } from "./actions";
import { PipelineBoard } from "./pipeline-board";
import { PipelineActionsMenu } from "./pipeline-actions-menu";

export default async function BureauPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;

  const [list, keys] = await Promise.all([
    listPipelines(),
    db
      .select({
        id: providerKeys.id,
        label: providerKeys.label,
        type: providerKeys.type,
      })
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
            Chaque pipeline est une équipe d&apos;agents que vous composez :
            recherche, vérification, relecture, rédaction. Chaque agent tourne
            sur la clé et le modèle de votre choix.
          </p>
        </div>
      </header>

      {keys.length === 0 ? (
        <EmptyKeysState />
      ) : list.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-10">
          {list.map(({ pipeline, agents }) => (
            <section
              key={pipeline.id}
              className="rounded-2xl border border-border bg-card/50 p-6 md:p-8"
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                    {pipeline.isPreset ? "Preset système" : "Pipeline cabinet"}
                    <span>·</span>
                    <span className="font-mono normal-case tracking-normal">
                      {pipeline.slug}
                    </span>
                  </div>
                  <h2 className="mt-1 font-heading text-2xl tracking-tight">
                    {pipeline.name}
                  </h2>
                  {pipeline.description && (
                    <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
                      {pipeline.description}
                    </p>
                  )}
                </div>
                <PipelineActionsMenu pipeline={pipeline} />
              </div>

              <PipelineBoard
                pipeline={pipeline}
                agents={agents}
                providerKeys={keys}
              />

              {pipeline.isPreset && (
                <p className="mt-6 text-xs text-muted-foreground border-t border-border/50 pt-4">
                  Cette pipeline est livrée avec Louis (preset système). Pour
                  la modifier, clonez-la depuis le menu •••, puis éditez la
                  copie.
                </p>
              )}
            </section>
          ))}
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
          Le bureau orchestre des agents qui appellent des modèles via vos
          clés. Rendez-vous dans{" "}
          <a
            href="/settings/providers"
            className="underline underline-offset-2"
          >
            Réglages › Providers
          </a>{" "}
          pour en ajouter une.
        </p>
      </div>
    </div>
  );
}
