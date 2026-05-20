import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { IconSparkles } from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { workflows } from "@/db/schema";
import { ImportDefaultsButton } from "./import-defaults-button";
import { WorkflowCard } from "./workflow-card";
import { AddWorkflowDialog } from "./add-workflow-dialog";

export default async function WorkflowsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const list = await db
    .select()
    .from(workflows)
    .where(eq(workflows.userId, userId))
    .orderBy(desc(workflows.updatedAt));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-8 md:py-14">
      <header className="mb-10 flex items-end justify-between gap-4 flex-wrap">
        <div className="max-w-2xl">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Bibliothèque cabinet
          </p>
          <h1 className="mt-2 font-heading text-4xl tracking-tight">
            Workflows.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Prompts réutilisables — résumé d&apos;arrêt, analyse de clause,
            due diligence. Insérez-les d&apos;un clic dans une conversation
            via l&apos;icône{" "}
            <IconSparkles className="inline size-3.5 align-text-bottom" />.
          </p>
        </div>
        <AddWorkflowDialog />
      </header>

      {list.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {list.map((w) => (
            <WorkflowCard key={w.id} workflow={w} />
          ))}
        </ul>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="py-16 border-y border-dashed border-border">
      <p className="font-heading text-2xl tracking-tight">
        Pas encore de workflow.
      </p>
      <p className="mt-3 text-sm text-muted-foreground max-w-md">
        Importez la bibliothèque par défaut (5 templates juridiques
        courants) pour démarrer, ou créez votre propre prompt depuis zéro.
      </p>
      <div className="mt-6">
        <ImportDefaultsButton />
      </div>
    </div>
  );
}
