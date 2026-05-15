import Link from "next/link";
import { asc, desc, eq, and } from "drizzle-orm";
import { IconFolder, IconChevronRight } from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  documents,
  documentFolders,
  projects,
  type Document,
  type DocumentFolder,
} from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { UploadButton } from "./upload-button";
import { DocumentRow } from "./document-row";
import { FolderRow } from "./folder-row";
import { NewFolderButton } from "./new-folder-button";

type SP = { folder?: string };

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { folder: folderParam } = await searchParams;
  const currentFolderId = folderParam ?? null;

  // Charge tout — volume documentaire d'un cabinet reste modeste pour l'usage
  // interne (quelques milliers de docs max). On filtre côté JS pour pouvoir
  // construire en parallèle la breadcrumb et les sous-dossiers.
  const [allDocs, allFolders, projectList, currentFolder] = await Promise.all([
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
  ]);

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
          <h1 className="font-heading text-3xl tracking-tight">Documents</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Vos fichiers sont stockés sur <strong>votre</strong> infrastructure
            (S3, MinIO, OVH Object Storage…). Organisez-les en dossiers et
            attachez-les à vos conversations.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <NewFolderButton parentFolderId={currentFolderId} />
          <UploadButton folderId={currentFolderId} />
        </div>
      </header>

      <nav
        aria-label="Fil d'Ariane"
        className="mb-5 flex items-center gap-1 text-sm text-muted-foreground flex-wrap"
      >
        <Link
          href="/documents"
          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
            !currentFolderId ? "text-foreground font-medium" : ""
          }`}
        >
          <IconFolder className="size-3.5" />
          Racine
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
          <Badge variant="outline">
            {totalDocs} document{totalDocs > 1 ? "s" : ""} au total
          </Badge>
          {allFolders.length > 0 && (
            <Badge variant="outline">
              {allFolders.length} dossier{allFolders.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      )}

      {isEmpty ? (
        <EmptyState isRoot={!currentFolderId} />
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border bg-card">
          {subFolders.map((f) => (
            <FolderRow key={f.id} folder={f} />
          ))}
          {familyViews.map((fv) => (
            <DocumentRow
              key={fv.latest.id}
              entry={fv.latest}
              projects={projectList}
              folders={allFolders}
              versions={fv.older}
            />
          ))}
        </div>
      )}

      <FormatsNote />
    </main>
  );
}

function EmptyState({ isRoot }: { isRoot: boolean }) {
  return (
    <div className="border border-dashed border-border rounded-lg p-10 text-center">
      <h2 className="font-heading text-lg">
        {isRoot ? "Aucun document" : "Dossier vide"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        {isRoot
          ? "Importez vos premiers fichiers — Louis en extrait le texte automatiquement. Vous pourrez ensuite les attacher à une conversation pour interroger leur contenu."
          : "Aucun document ni sous-dossier ici. Utilisez Importer ou Nouveau dossier."}
      </p>
    </div>
  );
}

function FormatsNote() {
  return (
    <aside className="mt-10 border-l-2 border-primary/50 pl-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Formats acceptés</p>
      <p className="mt-1">
        PDF, DOCX et texte brut. Limite : 25 Mo par fichier, ~500 000
        caractères extraits. Au-delà, l&apos;extraction est tronquée — le
        RAG (chunking + embeddings) arrive en v0.3.
      </p>
    </aside>
  );
}
