import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, eq, isNotNull, or } from "drizzle-orm";
import {
  IconArrowLeft,
  IconTable,
} from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  documents,
  tabularReviews,
  tabularReviewRows,
  type ReviewColumn,
  type TabularReviewRow,
} from "@/db/schema";
import { ReviewGrid } from "./review-grid";
import { ReviewActions } from "./review-actions";
import { AutoRefresh } from "./auto-refresh";
import { AddDocumentsDialog } from "./add-documents-dialog";

type Params = { id: string };

type EnrichedRow = TabularReviewRow & { filename: string };

export default async function TabularReviewDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const t = await getTranslations("tabularReviews");

  const { id } = await params;

  const [review] = await db
    .select()
    .from(tabularReviews)
    .where(
      and(
        eq(tabularReviews.id, id),
        eq(tabularReviews.userId, userId)
      )
    )
    .limit(1);

  if (!review) notFound();

  const rows: EnrichedRow[] = await db
    .select({
      id: tabularReviewRows.id,
      reviewId: tabularReviewRows.reviewId,
      documentId: tabularReviewRows.documentId,
      values: tabularReviewRows.values,
      status: tabularReviewRows.status,
      error: tabularReviewRows.error,
      createdAt: tabularReviewRows.createdAt,
      updatedAt: tabularReviewRows.updatedAt,
      filename: documents.filename,
    })
    .from(tabularReviewRows)
    .innerJoin(documents, eq(documents.id, tabularReviewRows.documentId))
    .where(eq(tabularReviewRows.reviewId, id));

  const columns = (review.columns ?? []) as ReviewColumn[];
  const pendingCount = rows.filter(
    (r) => r.status === "pending" || r.status === "error"
  ).length;
  const runningCount = rows.filter((r) => r.status === "running").length;

  // H15-c : documents indexables pas encore dans l'analyse, pour l'ajout.
  const existingDocIds = new Set(rows.map((r) => r.documentId));
  const allUserDocs = await db
    .select({ id: documents.id, filename: documents.filename })
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        or(
          isNotNull(documents.extractedText),
          isNotNull(documents.encExtractedText)
        )
      )
    );
  const availableDocuments = allUserDocs.filter(
    (d) => !existingDocIds.has(d.id)
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8 md:px-8 md:py-10">
      <Link
        href="/tabular-reviews"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <IconArrowLeft className="size-3.5" />
        {t("detail.backToAll")}
      </Link>

      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="size-11 shrink-0 rounded-md bg-muted flex items-center justify-center mt-0.5">
            <IconTable className="size-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading text-3xl tracking-tight truncate">
              {review.name}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("detail.columnsCount", { count: columns.length })} ·{" "}
              {t("detail.documentsCount", { count: rows.length })}
              {pendingCount > 0 && (
                <>
                  {" "}
                  · <span className="text-foreground">{t("detail.pendingCount", { count: pendingCount })}</span>
                </>
              )}
              {runningCount > 0 && (
                <>
                  {" "}
                  · <span className="text-primary">{t("detail.runningCount", { count: runningCount })}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddDocumentsDialog
            reviewId={review.id}
            availableDocuments={availableDocuments}
          />
          <ReviewActions
            reviewId={review.id}
            pendingCount={pendingCount}
            totalRows={rows.length}
          />
        </div>
      </header>

      <ReviewGrid columns={columns} rows={rows} reviewId={review.id} />
      <AutoRefresh hasRunning={runningCount > 0} />
    </main>
  );
}
