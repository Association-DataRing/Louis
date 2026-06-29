import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  IconArrowLeft,
  IconMessageCircle,
  IconPlus,
  IconUsersGroup,
} from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { conversations, documents, projects, users } from "@/db/schema";
import { getProjectScope } from "@/lib/projects/scope";
import {
  resolveProjectAccess,
  listProjectCollaborators,
  listAddableUsers,
} from "@/lib/projects/access";
import { ProjectActions } from "./project-actions";
import { ProjectDocuments } from "./project-documents";
import { CollaboratorsSection } from "./collaborators-section";

type Params = { id: string };

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const t = await getTranslations("projects.detail");

  const { id } = await params;

  // Autorisation centralisée : propriétaire, membre ou admin. Le périmètre
  // documentaire est celui du PROPRIÉTAIRE (`access.ownerId`).
  const access = await resolveProjectAccess(userId, id);
  if (!access) notFound();

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!project) notFound();

  const scope = await getProjectScope(access.ownerId, id);

  const [convList, docList, owner, collaborators, addableUsers] =
    await Promise.all([
      // Conversations du projet : celles de TOUS les membres (plus de filtre
      // userId — un collaborateur voit le fil partagé du dossier).
      db
        .select({
          id: conversations.id,
          title: conversations.title,
          updatedAt: conversations.updatedAt,
          authorName: users.name,
        })
        .from(conversations)
        .innerJoin(users, eq(users.id, conversations.userId))
        .where(eq(conversations.projectId, id))
        .orderBy(desc(conversations.updatedAt)),
      scope.documentIds.length > 0
        ? db
            .select({
              id: documents.id,
              filename: documents.filename,
              contentType: documents.contentType,
              sizeBytes: documents.sizeBytes,
              createdAt: documents.createdAt,
            })
            .from(documents)
            // scope.documentIds = périmètre du projet (frontière d'autorisation,
            // déjà résolu sur le propriétaire). Pas de filtre userId pour inclure
            // aussi les documents déposés par des collaborateurs.
            .where(inArray(documents.id, scope.documentIds))
            .orderBy(desc(documents.createdAt))
        : Promise.resolve([]),
      db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, access.ownerId))
        .limit(1),
      listProjectCollaborators(id),
      access.canManage ? listAddableUsers(id, access.ownerId) : Promise.resolve([]),
    ]);

  const isShared = collaborators.length > 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-8 md:py-10">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <IconArrowLeft className="size-3.5" />
        {t("backToProjects")}
      </Link>

      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl tracking-tight truncate inline-flex items-center gap-2">
            {project.name}
            {isShared && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                title="Projet partagé"
              >
                <IconUsersGroup className="size-3" />
                Partagé
              </span>
            )}
          </h1>
          {project.description && (
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              {project.description}
            </p>
          )}
          {!access.isOwner && (
            <p className="mt-1 text-xs text-muted-foreground">
              Dossier de {owner[0]?.name ?? "—"}
              {access.isMember
                ? " · partagé avec vous"
                : access.isAdmin
                  ? " · accès administrateur"
                  : ""}
            </p>
          )}
        </div>
        {access.isOwner && (
          <ProjectActions
            id={project.id}
            name={project.name}
            description={project.description}
          />
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Conversations */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg tracking-tight inline-flex items-center gap-2">
              <IconMessageCircle className="size-4 text-muted-foreground" />
              {t("conversations")}
              <span className="text-xs text-muted-foreground font-normal">
                ({convList.length})
              </span>
            </h2>
            <Link
              href={`/chat?project=${project.id}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2"
            >
              <IconPlus className="size-3" />
              {t("newConversation")}
            </Link>
          </div>
          {convList.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-6 text-sm text-muted-foreground">
              {t("emptyConversations")}
            </div>
          ) : (
            <div className="border border-border rounded-lg bg-card divide-y divide-border">
              {convList.map((c) => (
                <Link
                  key={c.id}
                  href={`/chat?id=${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors"
                >
                  <IconMessageCircle
                    className="size-3.5 text-muted-foreground shrink-0"
                    aria-hidden
                  />
                  <span className="text-sm truncate flex-1 min-w-0">
                    {c.title}
                  </span>
                  {isShared && (
                    <span className="text-[11px] text-muted-foreground truncate max-w-28">
                      {c.authorName}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {new Date(c.updatedAt).toLocaleDateString("fr-FR")}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Documents */}
        <ProjectDocuments folderId={scope.folderId} docs={docList} />
      </div>

      <CollaboratorsSection
        projectId={project.id}
        ownerName={owner[0]?.name ?? "—"}
        ownerEmail={owner[0]?.email ?? ""}
        collaborators={collaborators.map((c) => ({
          userId: c.userId,
          name: c.name,
          email: c.email,
        }))}
        addableUsers={addableUsers}
        canManage={access.canManage}
      />
    </main>
  );
}
