import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { UploadButton } from "./upload-button";
import { DocumentRow } from "./document-row";

export default async function DocumentsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const docs = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt));

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

      {docs.length > 0 && (
        <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            {docs.length} document{docs.length > 1 ? "s" : ""}
          </Badge>
        </div>
      )}

      {docs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border bg-card">
          {docs.map((doc) => (
            <DocumentRow key={doc.id} entry={doc} />
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
