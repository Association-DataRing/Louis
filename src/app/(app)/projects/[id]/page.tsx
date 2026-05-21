import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import {
  IconArrowLeft,
  IconFolder,
  IconMessageCircle,
  IconFileText,
  IconPlus,
} from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { conversations, documents, projects } from "@/db/schema";
import { ProjectActions } from "./project-actions";

type Params = { id: string };

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const { id } = await params;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);

  if (!project) notFound();

  const [convList, docList] = await Promise.all([
    db
      .select({
        id: conversations.id,
        title: conversations.title,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.projectId, id),
          eq(conversations.userId, userId)
        )
      )
      .orderBy(desc(conversations.updatedAt)),
    db
      .select({
        id: documents.id,
        filename: documents.filename,
        contentType: documents.contentType,
        sizeBytes: documents.sizeBytes,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(
        and(eq(documents.projectId, id), eq(documents.userId, userId))
      )
      .orderBy(desc(documents.createdAt)),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-8 md:py-10">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <IconArrowLeft className="size-3.5" />
        Tous les projets
      </Link>

      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="size-11 shrink-0 rounded-md bg-muted flex items-center justify-center mt-0.5">
            <IconFolder className="size-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading text-3xl tracking-tight truncate">
              {project.name}
            </h1>
            {project.description && (
              <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
                {project.description}
              </p>
            )}
          </div>
        </div>
        <ProjectActions
          id={project.id}
          name={project.name}
          description={project.description}
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Conversations */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg tracking-tight inline-flex items-center gap-2">
              <IconMessageCircle className="size-4 text-muted-foreground" />
              Conversations
              <span className="text-xs text-muted-foreground font-normal">
                ({convList.length})
              </span>
            </h2>
            <Link
              href={`/chat?project=${project.id}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2"
            >
              <IconPlus className="size-3" />
              Nouvelle conversation
            </Link>
          </div>
          {convList.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
              Aucune conversation pour l&apos;instant.
            </div>
          ) : (
            <div className="border border-border rounded-lg bg-card divide-y divide-border">
              {convList.map((c) => (
                <Link
                  key={c.id}
                  href={`/chat?id=${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors"
                >
                  <IconMessageCircle className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate flex-1 min-w-0">
                    {c.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {new Date(c.updatedAt).toLocaleDateString("fr-FR")}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Documents */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg tracking-tight inline-flex items-center gap-2">
              <IconFileText className="size-4 text-muted-foreground" />
              Documents
              <span className="text-xs text-muted-foreground font-normal">
                ({docList.length})
              </span>
            </h2>
            <Link
              href="/documents"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2"
            >
              <IconPlus className="size-3" />
              Importer un document
            </Link>
          </div>
          {docList.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
              Aucun document rattaché à ce projet.
            </div>
          ) : (
            <div className="border border-border rounded-lg bg-card divide-y divide-border">
              {docList.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <IconFileText className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate flex-1 min-w-0">
                    {d.filename}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {new Date(d.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
