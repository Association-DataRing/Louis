import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { IconArrowUpRight, IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { db } from "@/db";
import { tabularReviews, tabularReviewRows } from "@/db/schema";

export default async function TabularReviewsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

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
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-8 md:py-14">
      <header className="mb-10 flex items-end justify-between gap-4 flex-wrap">
        <div className="max-w-2xl">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Excel-style sur N documents
          </p>
          <h1 className="mt-2 font-heading text-4xl tracking-tight">
            Analyses tabulaires.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Définissez vos colonnes (durée, montant, juridiction, clauses…),
            sélectionnez un lot de documents, obtenez un tableau structuré.
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
        <ul className="divide-y divide-border border-y border-border">
          {list.map((r) => (
            <li key={r.id}>
              <Link
                href={`/tabular-reviews/${r.id}`}
                className="group grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-x-6 items-baseline py-5 hover:text-primary transition-colors"
              >
                <p className="font-heading text-lg tracking-tight truncate">
                  {r.name}
                </p>
                <span className="hidden sm:inline-block text-xs text-muted-foreground tabular-nums">
                  {r.columnsCount} colonne{r.columnsCount > 1 ? "s" : ""}
                </span>
                <span className="hidden sm:inline-block text-xs text-muted-foreground tabular-nums">
                  {r.rowsCount} doc{r.rowsCount > 1 ? "s" : ""}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums sm:w-20 sm:text-right inline-flex items-center gap-1 justify-end">
                  {new Date(r.updatedAt).toLocaleDateString("fr-FR")}
                  <IconArrowUpRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <aside className="mt-12 max-w-2xl border-l-2 border-primary/40 pl-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Cas d&apos;usage type :</strong>{" "}
        30 contrats fournisseurs, colonnes durée / montant / juridiction /
        clause de résiliation / clause RGPD, extraction en lot, tableau
        comparable. Les valeurs sont réutilisables ensuite dans le chat.
      </aside>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="py-16 border-y border-dashed border-border">
      <p className="font-heading text-2xl tracking-tight">
        Pas encore d&apos;analyse.
      </p>
      <p className="mt-3 text-sm text-muted-foreground max-w-md">
        Vous définirez les colonnes, choisirez vos documents, et lancerez
        l&apos;extraction. L&apos;IA remplit le tableau ligne par ligne.
      </p>
      <Link
        href="/tabular-reviews/new"
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        <IconPlus className="size-4" />
        Créer une analyse
      </Link>
    </div>
  );
}
