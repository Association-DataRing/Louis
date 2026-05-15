import { asc, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents, projects, type Document } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { UploadButton } from "./upload-button";
import { DocumentRow } from "./document-row";

export default async function DocumentsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [docs, projectList] = await Promise.all([
    db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt)),
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(asc(projects.name)),
  ]);

  // Group documents by family (rootId = parentDocumentId ?? id). For each
  // family we keep the highest-version row as the "primary" displayed in the
  // list, and surface the rest as collapsible history.
  const families = new Map<string, Document[]>();
  for (const d of docs) {
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

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Documents</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Vos fichiers sont stockés sur <strong>votre</strong> infrastructure
            (S3, MinIO, OVH Object Storage…). Le texte est extrait
            côté serveur pour pouvoir être attaché à une conversation.
          </p>
        </div>
        <UploadButton />
      </header>

      {familyViews.length > 0 && (
        <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            {familyViews.length} document{familyViews.length > 1 ? "s" : ""}
          </Badge>
        </div>
      )}

      {familyViews.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border bg-card">
          {familyViews.map((fv) => (
            <DocumentRow
              key={fv.latest.id}
              entry={fv.latest}
              projects={projectList}
              versions={fv.older}
            />
          ))}
        </div>
      )}

      <FormatsNote />
    </main>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-border rounded-lg p-10 text-center">
      <h2 className="font-heading text-lg">Aucun document</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        Importez vos premiers fichiers — Louis en extrait le texte
        automatiquement. Vous pourrez ensuite les attacher à une
        conversation pour interroger leur contenu.
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
