import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { asc, desc, eq, and, sql } from "drizzle-orm";
import { IconFolder, IconChevronRight } from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  documents,
  documentChunks,
  documentFolders,
  providerKeys,
  projects,
  type Document,
  type DocumentFolder,
} from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { UploadButton } from "./upload-button";
import { ReindexAllButton } from "./reindex-all-button";
import { DocumentRow } from "./document-row";
import { FolderRow } from "./folder-row";
import { NewFolderButton } from "./new-folder-button";
import { DocumentsDropzone } from "./documents-dropzone";
import { ModuleHelp } from "@/components/module-help";

type SP = { folder?: string };

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const t = await getTranslations("documents.page");
  const { folder: folderParam } = await searchParams;
  const currentFolderId = folderParam ?? null;

  // Charge tout — volume documentaire d'un cabinet reste modeste pour l'usage
  // interne (quelques milliers de docs max). On filtre côté JS pour pouvoir
  // construire en parallèle la breadcrumb et les sous-dossiers.
  const [
    allDocs,
    allFolders,
    projectList,
    currentFolder,
    chunkCountRows,
    mistralKeys,
  ] = await Promise.all([
    db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt)),
    db
      .select()
      .from(documentFolders)
      .where(eq(documentFolders.userId, userId))
      .orderBy(asc(documentFolders.name)),
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(asc(projects.name)),
    currentFolderId
      ? db
          .select()
          .from(documentFolders)
          .where(
            and(
              eq(documentFolders.id, currentFolderId),
              eq(documentFolders.userId, userId)
            )
          )
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    // R6 : nombre de chunks indexés par document (transparence RAG).
    db
      .select({
        documentId: documentChunks.documentId,
        n: sql<number>`count(*)::int`,
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documents.id, documentChunks.documentId))
      .where(eq(documents.userId, userId))
      .groupBy(documentChunks.documentId),
    db
      .select({ id: providerKeys.id })
      .from(providerKeys)
      .where(
        and(
          eq(providerKeys.userId, userId),
          eq(providerKeys.type, "mistral"),
          eq(providerKeys.isActive, true)
        )
      )
      .limit(1),
  ]);

  // Transparence RAG : chunks par doc + disponibilité d'un backend d'embedding.
  // L'embedding fonctionne si : clé Mistral BYOK active OU LOUIS_EMBEDDING_BASE_URL
  // configuré (endpoint OpenAI-compatible auto-hébergé ou OpenRouter via .env).
  const chunkCountByDoc = new Map<string, number>(
    chunkCountRows.map((r) => [r.documentId, r.n])
  );
  const hasMistralKey =
    mistralKeys.length > 0 || !!process.env.LOUIS_EMBEDDING_BASE_URL?.trim();

  // Construit la breadcrumb en remontant via parentFolderId.
  const folderById = new Map<string, DocumentFolder>(
    allFolders.map((f) => [f.id, f])
  );
  const breadcrumb: DocumentFolder[] = [];
  if (currentFolder) {
    let node: DocumentFolder | null = currentFolder;
    while (node) {
      breadcrumb.unshift(node);
      node = node.parentFolderId ? folderById.get(node.parentFolderId) ?? null : null;
    }
  }

  // Sous-dossiers directs du dossier courant.
  const subFolders = allFolders.filter((f) =>
    currentFolderId
      ? f.parentFolderId === currentFolderId
      : f.parentFolderId === null
  );

  // Documents directs du dossier courant.
  const docsHere = allDocs.filter((d) =>
    currentFolderId ? d.folderId === currentFolderId : d.folderId === null
  );

  // Group by version family inside this folder.
  const families = new Map<string, Document[]>();
  for (const d of docsHere) {
    const rootId = d.parentDocumentId ?? d.id;
    const list = families.get(rootId) ?? [];
    list.push(d);
    families.set(rootId, list);
  }
  type FamilyView = { latest: Document; older: Document[] };
  const familyViews: FamilyView[] = Array.from(families.values()).map(
    (members) => {
      const sorted = [...members].sort((a, b) => b.version - a.version);
      return { latest: sorted[0], older: sorted.slice(1) };
    }
  );
  familyViews.sort(
    (a, b) =>
      new Date(b.latest.createdAt).getTime() -
      new Date(a.latest.createdAt).getTime()
  );

  const isEmpty = subFolders.length === 0 && familyViews.length === 0;
  const totalDocs = allDocs.length;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {t("eyebrow")}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <h1 className="font-heading text-4xl tracking-tight">
              {t("title")}
            </h1>
            <ModuleHelp slug="user/documents" title={t("helpTitle")}>
              {t("helpBody")}
            </ModuleHelp>
          </div>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            {t.rich("intro", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {totalDocs > 0 && <ReindexAllButton />}
          <NewFolderButton parentFolderId={currentFolderId} />
          <UploadButton folderId={currentFolderId} />
        </div>
      </header>

      <nav
        aria-label={t("breadcrumbAria")}
        className="mb-5 flex items-center gap-1 text-sm text-muted-foreground flex-wrap"
      >
        <Link
          href="/documents"
          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
            !currentFolderId ? "text-foreground font-medium" : ""
          }`}
        >
          <IconFolder className="size-3.5" />
          {t("root")}
        </Link>
        {breadcrumb.map((f, i) => (
          <span key={f.id} className="flex items-center gap-1">
            <IconChevronRight className="size-3 opacity-60" />
            <Link
              href={`/documents?folder=${f.id}`}
              className={`hover:text-foreground transition-colors ${
                i === breadcrumb.length - 1 ? "text-foreground font-medium" : ""
              }`}
            >
              {f.name}
            </Link>
          </span>
        ))}
      </nav>

      {totalDocs > 0 && (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{t("docsTotal", { count: totalDocs })}</Badge>
          {allFolders.length > 0 && (
            <Badge variant="outline">
              {t("foldersCount", { count: allFolders.length })}
            </Badge>
          )}
        </div>
      )}

      <DocumentsDropzone folderId={currentFolderId}>
        {isEmpty ? (
          <EmptyState isRoot={!currentFolderId} />
        ) : (
          <ul
            role="list"
            className="border border-border rounded-lg divide-y divide-border bg-card"
          >
            {subFolders.map((f) => (
              <li key={f.id}>
                <FolderRow
                  folder={f}
                  subfolderCount={countDescendantFolders(f.id, allFolders)}
                />
              </li>
            ))}
            {familyViews.map((fv) => (
              <li key={fv.latest.id}>
                <DocumentRow
                  entry={fv.latest}
                  projects={projectList}
                  folders={allFolders}
                  versions={fv.older}
                  chunkCount={chunkCountByDoc.get(fv.latest.id) ?? 0}
                  hasMistralKey={hasMistralKey}
                />
              </li>
            ))}
          </ul>
        )}
      </DocumentsDropzone>

      <FormatsNote />
    </main>
  );
}

/** Nombre de sous-dossiers (récursif) d'un dossier — pour avertir de la
 * suppression en cascade (H20). */
function countDescendantFolders(
  folderId: string,
  all: DocumentFolder[]
): number {
  return all
    .filter((f) => f.parentFolderId === folderId)
    .reduce((n, c) => n + 1 + countDescendantFolders(c.id, all), 0);
}

async function EmptyState({ isRoot }: { isRoot: boolean }) {
  const t = await getTranslations("documents.page");
  return (
    <div className="border border-dashed border-border rounded-lg p-10 text-center">
      <h2 className="font-heading text-lg">
        {isRoot ? t("emptyRootTitle") : t("emptyFolderTitle")}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        {isRoot ? t("emptyRootBody") : t("emptyFolderBody")}
      </p>
    </div>
  );
}

async function FormatsNote() {
  const t = await getTranslations("documents.page");
  return (
    <aside className="mt-10 border-l-2 border-primary/50 pl-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{t("formatsTitle")}</p>
      <p className="mt-1">{t("formatsBody")}</p>
    </aside>
  );
}
