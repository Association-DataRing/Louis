import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import {
  IconFolder,
  IconArrowRight,
  IconMessageCircle,
  IconFileText,
} from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { conversations, documents, projects } from "@/db/schema";
import { AddProjectDialog } from "./add-project-dialog";

export default async function ProjectsPage() {
  const session = await auth();
  const userId = session!.user.id;

  // Récupère projets + comptes de conversations/documents par projet
  const list = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      convCount: sql<number>`(
        SELECT COUNT(*) FROM ${conversations}
        WHERE ${conversations.projectId} = ${projects.id}
      )::int`,
      docCount: sql<number>`(
        SELECT COUNT(*) FROM ${documents}
        WHERE ${documents.projectId} = ${projects.id}
      )::int`,
    })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt));

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Projets</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Groupez vos conversations, documents et collaborateurs autour
            d&apos;un dossier client, d&apos;une affaire, d&apos;une thématique.
          </p>
        </div>
        <AddProjectDialog />
      </header>

      {list.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="border border-border rounded-lg p-5 bg-card hover:border-primary/50 transition-colors flex flex-col gap-3 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="size-10 shrink-0 rounded-md bg-muted flex items-center justify-center">
                  <IconFolder className="size-5 text-primary" />
                </div>
                <IconArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="min-w-0">
                <h3 className="font-heading text-base tracking-tight truncate">
                  {p.name}
                </h3>
                {p.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {p.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
                <span className="inline-flex items-center gap-1">
                  <IconMessageCircle className="size-3.5" />
                  {p.convCount}
                </span>
                <span className="inline-flex items-center gap-1">
                  <IconFileText className="size-3.5" />
                  {p.docCount}
                </span>
                <span className="ml-auto">
                  {new Date(p.updatedAt).toLocaleDateString("fr-FR")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <aside className="mt-12 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Un projet est un conteneur partagé : conversations, documents
        importés, et bientôt connecteurs activés y sont regroupés.
        Particulièrement adapté pour suivre un dossier client de bout en bout.
      </aside>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-border rounded-lg p-10 text-center">
      <IconFolder className="size-8 text-muted-foreground mx-auto mb-3" />
      <h2 className="font-heading text-lg">Aucun projet pour l&apos;instant</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        Créez votre premier projet. Vous pourrez ensuite y rattacher vos
        conversations et vos documents pour les retrouver en un clic.
      </p>
    </div>
  );
}
