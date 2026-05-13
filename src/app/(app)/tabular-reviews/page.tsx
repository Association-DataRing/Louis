import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import {
  IconTable,
  IconArrowRight,
  IconPlus,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { db } from "@/db";
import { tabularReviews, tabularReviewRows } from "@/db/schema";

export default async function TabularReviewsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const list = await db
    .select({
      id: tabularReviews.id,
      name: tabularReviews.name,
      columnsCount: sql<number>`jsonb_array_length(${tabularReviews.columns})`,
      rowsCount: sql<number>`(
        SELECT COUNT(*) FROM ${tabularReviewRows}
        WHERE ${tabularReviewRows.reviewId} = ${tabularReviews.id}
      )::int`,
      createdAt: tabularReviews.createdAt,
      updatedAt: tabularReviews.updatedAt,
    })
    .from(tabularReviews)
    .where(eq(tabularReviews.userId, userId))
    .orderBy(desc(tabularReviews.updatedAt));

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">
            Analyses tabulaires
          </h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Extrayez des informations structurées d&apos;un lot de documents en
            définissant les colonnes à remplir. Idéal pour comparer des
            contrats, mémos ou décisions sur des critères uniformes.
          </p>
        </div>
        <Link href="/tabular-reviews/new">
          <Button>
            <IconPlus className="size-4" />
            Nouvelle analyse
          </Button>
        </Link>
      </header>

      {list.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((r) => (
            <Link
              key={r.id}
              href={`/tabular-reviews/${r.id}`}
              className="border border-border rounded-lg p-5 bg-card hover:border-primary/50 transition-colors flex flex-col gap-3 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="size-10 shrink-0 rounded-md bg-muted flex items-center justify-center">
                  <IconTable className="size-5 text-primary" />
                </div>
                <IconArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h3 className="font-heading text-base tracking-tight truncate">
                {r.name}
              </h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
                <span>
                  {r.columnsCount} colonne{r.columnsCount > 1 ? "s" : ""}
                </span>
                <span>·</span>
                <span>
                  {r.rowsCount} document{r.rowsCount > 1 ? "s" : ""}
                </span>
                <span className="ml-auto">
                  {new Date(r.updatedAt).toLocaleDateString("fr-FR")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <aside className="mt-12 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Cas d&apos;usage typique :</strong>{" "}
        importez 30 contrats fournisseurs, définissez les colonnes (durée,
        montant, juridiction, clause de résiliation, clause RGPD…), lancez
        l&apos;extraction et obtenez un tableau Excel-style pour comparaison.
        Les valeurs extraites peuvent être réutilisées dans une conversation
        de chat.
      </aside>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-border rounded-lg p-10 text-center">
      <IconTable className="size-8 text-muted-foreground mx-auto mb-3" />
      <h2 className="font-heading text-lg">Aucune analyse pour l&apos;instant</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        Créez votre première analyse tabulaire. Vous définirez les colonnes,
        choisirez vos documents, et lancerez l&apos;extraction.
      </p>
      <Link
        href="/tabular-reviews/new"
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <IconPlus className="size-4" />
        Créer une analyse
      </Link>
    </div>
  );
}
