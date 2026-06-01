import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/permissions";
import { labelForAction } from "@/lib/audit/labels";

/**
 * H21 : export du journal d'audit (CSV/JSON), filtres identiques à la page.
 * requireAdmin LÈVE une erreur → on la catch pour renvoyer un 403 propre
 * (sans catch, un throw dans un route handler produit un 500). Le `meta`
 * (IP, user-agent…) est de la donnée perso RGPD → réservé aux admins.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    await requireAdmin();
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "json" ? "json" : "csv";
  const action = url.searchParams.get("action");
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const from = fromRaw ? new Date(fromRaw) : null;
  const to = toRaw ? new Date(`${toRaw}T23:59:59`) : null;

  const conds = [];
  if (action && action !== "all") conds.push(eq(auditLog.action, action));
  if (from && !Number.isNaN(from.getTime()))
    conds.push(gte(auditLog.createdAt, from));
  if (to && !Number.isNaN(to.getTime())) conds.push(lte(auditLog.createdAt, to));
  const where = conds.length > 0 ? and(...conds) : undefined;

  const rows = await db
    .select({
      action: auditLog.action,
      target: auditLog.target,
      meta: auditLog.meta,
      createdAt: auditLog.createdAt,
      actorEmail: users.email,
      actorName: users.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(10_000);

  if (format === "json") {
    const payload = rows.map((r) => ({
      date: new Date(r.createdAt).toISOString(),
      action: r.action,
      label: labelForAction(r.action),
      actor: r.actorName ?? r.actorEmail ?? null,
      target: r.target,
      meta: r.meta ?? null,
    }));
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="audit.json"',
        "Cache-Control": "no-store",
      },
    });
  }

  const header = ["Date", "Action", "Acteur", "Cible", "Détails"];
  const lines = [header.map(csvCell).join(";")];
  for (const r of rows) {
    lines.push(
      [
        new Date(r.createdAt).toISOString(),
        labelForAction(r.action),
        r.actorName ?? r.actorEmail ?? "",
        r.target ?? "",
        r.meta ? JSON.stringify(r.meta) : "",
      ]
        .map(csvCell)
        .join(";")
    );
  }
  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="audit.csv"',
      "Cache-Control": "no-store",
    },
  });
}

/** Échappement CSV + neutralisation de l'injection de formule. */
function csvCell(v: string): string {
  let s = v ?? "";
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
