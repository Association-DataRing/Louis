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
import { CloneToEditButton } from "./clone-to-edit-button";
import { PipelineModeBar } from "./pipeline-mode-bar";
import { AddAgentDialog } from "./add-agent-dialog";
import { InlineRename } from "./inline-rename";
import { listEnabledModels } from "../../settings/models/actions";

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

  const enabledRows = await listEnabledModels(userId);
  const enabledModels = enabledRows.map((r) => ({
    providerType: r.providerType,
    modelId: r.modelId,
    label: r.label ?? r.modelId,
    hint: r.hint,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 md:px-8 md:py-14">
      <header className="mb-10">
        <Link
          href="/board"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <IconArrowLeft className="size-3.5" />
          Board
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 max-w-2xl">
            <div className="text-xs text-foreground/70 uppercase tracking-wider">
              {data.pipeline.isPreset ? "Preset système" : "Pipeline cabinet"}
            </div>
            <div className="mt-2">
              <InlineRename
                pipelineId={data.pipeline.id}
                initialName={data.pipeline.name}
                description={data.pipeline.description}
                editable={!data.pipeline.isPreset}
              />
            </div>
            {data.pipeline.description && (
              <p className="mt-3 text-sm text-muted-foreground">
                {data.pipeline.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {data.pipeline.isPreset && (
              <CloneToEditButton pipelineId={data.pipeline.id} />
            )}
            <PipelineActionsMenu pipeline={data.pipeline} />
          </div>
        </div>
      </header>

      {data.pipeline.isPreset && (
        <div className="mb-6 rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 flex items-start gap-3">
          <div className="size-8 rounded-md grid place-items-center bg-foreground/5 shrink-0">
            <span className="text-xs font-mono">i</span>
          </div>
          <div className="text-sm">
            <p className="font-medium">
              Cette pipeline est un preset système — lecture seule.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pour personnaliser ses agents (modèle, prompt, outils),
              clonez-la d&apos;un clic. Votre copie sera modifiable et
              utilisable immédiatement dans le chat.
            </p>
          </div>
        </div>
      )}

      <PipelineModeBar pipeline={data.pipeline} agentCount={data.agents.length} />

      <div className="relative mt-6">
        <PipelineWorkflow
          pipeline={data.pipeline}
          agents={data.agents}
          providerKeys={keys}
          enabledModels={enabledModels}
        />
        {!data.pipeline.isPreset && (
          <div className="absolute left-4 bottom-4 z-10">
            <AddAgentDialog
              pipelineId={data.pipeline.id}
              providerKeys={keys}
              enabledModels={enabledModels}
            />
          </div>
        )}
      </div>

      <div className="mt-5 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          💡 Cliquez un agent pour l&apos;éditer
        </span>
        {data.pipeline.mode === "sequential" && !data.pipeline.isPreset && (
          <span>· Glissez les cartes pour réordonner</span>
        )}
        {data.pipeline.mode === "council" && (
          <span>
            · {data.pipeline.rounds} tour
            {data.pipeline.rounds > 1 ? "s" : ""} de débat
          </span>
        )}
        <span>· Chaque exécution est tracée dans l&apos;audit</span>
      </div>
    </main>
  );
}
