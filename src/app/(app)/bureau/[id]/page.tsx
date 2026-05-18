import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { IconArrowLeft } from "@tabler/icons-react";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { providerKeys } from "@/db/schema";
import { getPipeline } from "../actions";
import { PipelineActionsMenu } from "../pipeline-actions-menu";
import { PipelineWorkflow } from "./pipeline-workflow";

export default async function PipelineEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const { id } = await params;
  const data = await getPipeline(id);
  if (!data) notFound();

  const keys = await db
    .select({
      id: providerKeys.id,
      label: providerKeys.label,
      type: providerKeys.type,
    })
    .from(providerKeys)
    .where(eq(providerKeys.userId, userId))
    .orderBy(asc(providerKeys.label));

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 md:px-8 md:py-14">
      <header className="mb-10">
        <Link
          href="/bureau"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <IconArrowLeft className="size-3.5" />
          Bureau
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 max-w-2xl">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              {data.pipeline.isPreset ? "Preset système" : "Pipeline cabinet"}
              <span>·</span>
              <span className="font-mono normal-case tracking-normal">
                {data.pipeline.slug}
              </span>
            </div>
            <h1 className="mt-2 font-heading text-3xl md:text-4xl tracking-tight">
              {data.pipeline.name}
            </h1>
            {data.pipeline.description && (
              <p className="mt-3 text-sm text-muted-foreground">
                {data.pipeline.description}
              </p>
            )}
          </div>
          <PipelineActionsMenu pipeline={data.pipeline} />
        </div>
      </header>

      <PipelineWorkflow
        pipeline={data.pipeline}
        agents={data.agents}
        providerKeys={keys}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-3 text-xs">
        <Hint
          title="Cliquez sur un agent"
          body="Pour modifier son modèle, sa clé provider, son system prompt ou les outils autorisés."
        />
        <Hint
          title="Audit trail"
          body="Chaque exécution de la pipeline produit un agent_run par agent — tokens, latence, sortie."
        />
        <Hint
          title={
            data.pipeline.isPreset
              ? "Pipeline preset, lecture seule"
              : "Pipeline modifiable"
          }
          body={
            data.pipeline.isPreset
              ? "Pour modifier, clonez-la depuis le menu ••• puis éditez la copie."
              : "Modifications appliquées immédiatement aux prochaines exécutions."
          }
        />
      </div>
    </main>
  );
}

function Hint({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/30 p-3">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-muted-foreground">{body}</p>
    </div>
  );
}
