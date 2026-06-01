import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents, tabularReviews, tabularReviewRows } from "@/db/schema";

type Params = { id: string };

/**
 * H14 : export CSV d'une analyse tabulaire — le livrable « comparer un lot de
 * contrats dans un tableur ». Séparateur « ; » + BOM UTF-8 pour ouverture
 * native dans Excel/LibreOffice (accents préservés). Vérifie la propriété de
 * l'analyse (404 sinon, aucun octet de données).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;
  const { id } = await params;

  const [review] = await db
    .select({
      id: tabularReviews.id,
      name: tabularReviews.name,
      columns: tabularReviews.columns,
    })
    .from(tabularReviews)
    .where(and(eq(tabularReviews.id, id), eq(tabularReviews.userId, userId)))
    .limit(1);
  if (!review) return new Response("Not found", { status: 404 });

  const rows = await db
    .select({
      filename: documents.filename,
      values: tabularReviewRows.values,
      status: tabularReviewRows.status,
    })
    .from(tabularReviewRows)
    .innerJoin(documents, eq(documents.id, tabularReviewRows.documentId))
    .where(eq(tabularReviewRows.reviewId, id))
    .orderBy(asc(tabularReviewRows.createdAt));

  const header = ["Document", "Statut", ...review.columns.map((c) => c.label)];
  const lines = [header.map(csvCell).join(";")];
  for (const r of rows) {
    const cells = [
      r.filename,
      STATUS_LABEL[r.status] ?? r.status,
      ...review.columns.map((c) => r.values?.[c.id] ?? ""),
    ];
    lines.push(cells.map(csvCell).join(";"));
  }

  // BOM UTF-8 + CRLF (convention CSV) pour Excel.
  const csv = "﻿" + lines.join("\r\n") + "\r\n";

  const safeName =
    review.name
      .replace(/[^a-zA-Z0-9_\- ]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60)
      .trim() || "analyse";

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  running: "En cours",
  ok: "OK",
  error: "Erreur",
};

/** Échappement CSV : entoure de guillemets si séparateur/guillemet/saut de
 * ligne, double les guillemets internes. Préfixe d'une apostrophe les valeurs
 * commençant par =,+,-,@,tab,CR pour neutraliser l'injection de formule
 * (les valeurs viennent de l'extraction LLM / des noms de fichiers et sont
 * ouvertes dans Excel/LibreOffice). */
function csvCell(v: string): string {
  let s = v ?? "";
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
