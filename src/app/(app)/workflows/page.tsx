import { desc, eq } from "drizzle-orm";
import { IconLibrary, IconSparkles } from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { workflows } from "@/db/schema";
import { ImportDefaultsButton } from "./import-defaults-button";
import { WorkflowCard } from "./workflow-card";
import { AddWorkflowDialog } from "./add-workflow-dialog";

export default async function WorkflowsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const list = await db
    .select()
    .from(workflows)
    .where(eq(workflows.userId, userId))
    .orderBy(desc(workflows.updatedAt));

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Workflows</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Bibliothèque de prompts réutilisables — résumé d&apos;arrêt,
            analyse de clause, due diligence… Insérez-les d&apos;un clic
            dans une conversation.
          </p>
        </div>
        <AddWorkflowDialog />
      </header>

      {list.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((w) => (
            <WorkflowCard key={w.id} workflow={w} />
          ))}
        </div>
      )}

      <aside className="mt-12 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Astuce :</strong>{" "}
        Depuis n&apos;importe quelle conversation, cliquez sur l&apos;icône{" "}
        <IconSparkles className="inline size-3.5 align-text-bottom" /> dans le
        composer pour piquer un workflow et pré-remplir votre prompt.
      </aside>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-border rounded-lg p-10 text-center">
      <IconLibrary className="size-8 text-muted-foreground mx-auto mb-3" />
      <h2 className="font-heading text-lg">Aucun workflow pour l&apos;instant</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        Commencez par importer la bibliothèque suggérée (5 templates
        juridiques courants) ou créez votre propre prompt depuis zéro.
      </p>
      <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
        <ImportDefaultsButton />
      </div>
    </div>
  );
}
