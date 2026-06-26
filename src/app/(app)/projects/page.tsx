import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import {
  IconArrowUpRight,
  IconMessageCircle,
  IconFileText,
  IconUsersGroup,
} from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  conversations,
  documentFolders,
  projectMembers,
  projects,
  users,
} from "@/db/schema";
import { getProjectDocCounts, getProjectScope } from "@/lib/projects/scope";
import { ModuleHelp } from "@/components/module-help";
import { AddProjectDialog } from "./add-project-dialog";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: Date;
  convCount: number;
  docCount: number;
  shared: boolean;
  ownerName?: string;
};

export default async function ProjectsPage() {
  const session = await auth();
  // Garde défensive : si la session est null (cookie expiré, secret
  // changé, premier accès non authentifié), on redirige vers /login
  // plutôt que de crasher sur session.user.id.
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const convCountSql = sql<number>`(
    SELECT COUNT(*) FROM ${conversations}
    WHERE ${conversations.projectId} = ${projects.id}
  )::int`;

  // docCount via le sous-arbre du dossier-racine de chaque projet (modèle
  // dossier = projet), pas via documents.projectId qui n'est plus la source
  // de vérité.
  const [owned, memberRows, docCounts, folders] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        updatedAt: projects.updatedAt,
        convCount: convCountSql,
      })
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt)),
    // Projets partagés avec l'utilisateur (collaboration).
    db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        updatedAt: projects.updatedAt,
        ownerId: projects.userId,
        ownerName: users.name,
        convCount: convCountSql,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .innerJoin(users, eq(users.id, projects.userId))
      .where(eq(projectMembers.userId, userId))
      .orderBy(desc(projects.updatedAt)),
    getProjectDocCounts(userId),
    db
      .select({
        id: documentFolders.id,
        name: documentFolders.name,
        parentFolderId: documentFolders.parentFolderId,
      })
      .from(documentFolders)
      .where(eq(documentFolders.userId, userId)),
  ]);

  // Compteur de documents des projets partagés : périmètre du propriétaire.
  const sharedDocCounts = new Map(
    await Promise.all(
      memberRows.map(
        async (m) =>
          [m.id, (await getProjectScope(m.ownerId, m.id)).documentIds.length] as const
      )
    )
  );

  const list: ProjectRow[] = [
    ...owned.map((p) => ({
      ...p,
      docCount: docCounts.get(p.id) ?? 0,
      shared: false,
    })),
    ...memberRows.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      updatedAt: m.updatedAt,
      convCount: m.convCount,
      docCount: sharedDocCounts.get(m.id) ?? 0,
      shared: true,
      ownerName: m.ownerName,
    })),
  ].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-8 md:py-14">
      <header className="mb-10 flex items-end justify-between gap-4 flex-wrap">
        <div className="max-w-2xl">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Dossiers clients · matières · affaires
          </p>
          <div className="mt-2 flex items-center gap-2">
            <h1 className="font-heading text-4xl tracking-tight">Projets.</h1>
            <ModuleHelp slug="user/projects" title="Travailler par projet">
              Un projet regroupe les conversations et documents d&apos;un
              dossier client, et restreint le raisonnement de l&apos;IA à ce
              seul périmètre.
            </ModuleHelp>
          </div>
          <p className="mt-3 text-muted-foreground">
            Regroupez conversations et documents autour d&apos;un dossier
            client, d&apos;une affaire, d&apos;une thématique.
          </p>
        </div>
        <AddProjectDialog folders={folders} />
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
                  <p className="font-heading text-lg tracking-tight truncate inline-flex items-center gap-2">
                    {p.name}
                    {p.shared && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                        title={`Partagé par ${p.ownerName ?? ""}`}
                      >
                        <IconUsersGroup className="size-3" />
                        Partagé
                      </span>
                    )}
                  </p>
                  {p.description ? (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                      {p.description}
                    </p>
                  ) : p.shared ? (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                      Dossier de {p.ownerName}
                    </p>
                  ) : null}
                  <span className="mt-1 flex items-center gap-3 text-xs text-muted-foreground tabular-nums sm:hidden">
                    <span className="inline-flex items-center gap-1">
                      <IconMessageCircle className="size-3.5" aria-hidden />
                      {p.convCount}
                      <span className="sr-only">conversations</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconFileText className="size-3.5" aria-hidden />
                      {p.docCount}
                      <span className="sr-only">documents</span>
                    </span>
                  </span>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                  <IconMessageCircle className="size-3.5" aria-hidden />
                  {p.convCount}
                  <span className="sr-only">conversations</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                  <IconFileText className="size-3.5" aria-hidden />
                  {p.docCount}
                  <span className="sr-only">documents</span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums sm:w-20 sm:text-right inline-flex items-center gap-1 justify-end">
                  {new Date(p.updatedAt).toLocaleDateString("fr-FR")}
                  <IconArrowUpRight
                    className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-hidden
                  />
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
