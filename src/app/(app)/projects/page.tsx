import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import {
  IconArrowUpRight,
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
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-8 md:py-14">
      <header className="mb-10 flex items-end justify-between gap-4 flex-wrap">
        <div className="max-w-2xl">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Dossiers clients · matières · affaires
          </p>
          <h1 className="mt-2 font-heading text-4xl tracking-tight">
            Projets.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Regroupez conversations et documents autour d&apos;un dossier
            client, d&apos;une affaire, d&apos;une thématique.
          </p>
        </div>
        <AddProjectDialog />
      </header>

      {list.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {list.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="group grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-x-6 gap-y-1 items-baseline py-5 hover:text-primary transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-heading text-lg tracking-tight truncate">
                    {p.name}
                  </p>
                  {p.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                      {p.description}
                    </p>
                  )}
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                  <IconMessageCircle className="size-3.5" />
                  {p.convCount}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                  <IconFileText className="size-3.5" />
                  {p.docCount}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums sm:w-20 sm:text-right inline-flex items-center gap-1 justify-end">
                  {new Date(p.updatedAt).toLocaleDateString("fr-FR")}
                  <IconArrowUpRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <aside className="mt-12 max-w-2xl border-l-2 border-primary/40 pl-4 text-sm text-muted-foreground">
        Un projet est un conteneur partagé : conversations, documents et,
        bientôt, connecteurs activés y sont regroupés. Particulièrement adapté
        pour suivre un dossier client de bout en bout.
      </aside>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="py-16 border-y border-dashed border-border">
      <p className="font-heading text-2xl tracking-tight">
        Pas encore de projet.
      </p>
      <p className="mt-3 text-sm text-muted-foreground max-w-md">
        Un projet groupe les conversations et documents liés à un même
        dossier client. Vous gardez la trace de l&apos;affaire complète
        plutôt qu&apos;une suite de conversations isolées.
      </p>
    </div>
  );
}
