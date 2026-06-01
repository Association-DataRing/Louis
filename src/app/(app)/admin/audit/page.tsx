import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import Link from "next/link";
import { IconDownload } from "@tabler/icons-react";
import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/permissions";
import { labelForAction, AUDIT_ACTION_OPTIONS } from "@/lib/audit/labels";

const PAGE_SIZE = 50;

type SP = { action?: string; from?: string; to?: string; page?: string };

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const page = Math.max(0, Number.parseInt(sp.page ?? "0", 10) || 0);
  const action = sp.action && sp.action !== "all" ? sp.action : null;
  const from = sp.from ? new Date(sp.from) : null;
  const to = sp.to ? new Date(`${sp.to}T23:59:59`) : null;

  const conds = [];
  if (action) conds.push(eq(auditLog.action, action));
  if (from && !Number.isNaN(from.getTime()))
    conds.push(gte(auditLog.createdAt, from));
  if (to && !Number.isNaN(to.getTime())) conds.push(lte(auditLog.createdAt, to));
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(auditLog)
    .where(where);

  const rows = await db
    .select({
      id: auditLog.id,
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
    .limit(PAGE_SIZE)
    .offset(page * PAGE_SIZE);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterQs = new URLSearchParams();
  if (action) filterQs.set("action", action);
  if (sp.from) filterQs.set("from", sp.from);
  if (sp.to) filterQs.set("to", sp.to);
  const exportQs = filterQs.toString();
  const pageQs = (p: number) => {
    const q = new URLSearchParams(filterQs);
    if (p > 0) q.set("page", String(p));
    const s = q.toString();
    return s ? `/admin/audit?${s}` : "/admin/audit";
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-8 md:py-12">
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">
            Journal d&apos;audit
          </h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            {total} action{total > 1 ? "s" : ""} enregistrée{total > 1 ? "s" : ""}.
            Append-only — créations/modifications de comptes, providers,
            connecteurs, suppressions, authentification.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`/api/admin/audit/export?format=csv${exportQs ? `&${exportQs}` : ""}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm transition-colors hover:bg-accent"
          >
            <IconDownload className="size-4" />
            CSV
          </a>
          <a
            href={`/api/admin/audit/export?format=json${exportQs ? `&${exportQs}` : ""}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm transition-colors hover:bg-accent"
          >
            <IconDownload className="size-4" />
            JSON
          </a>
        </div>
      </header>

      {/* Filtres — formulaire GET, server component */}
      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-3 border-y border-border py-4"
      >
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Action
          <select
            name="action"
            defaultValue={action ?? "all"}
            className="h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <option value="all">Toutes</option>
            {AUDIT_ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Du
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Au
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground transition-opacity hover:opacity-90"
        >
          Filtrer
        </button>
        {(action || sp.from || sp.to) && (
          <Link
            href="/admin/audit"
            className="inline-flex h-9 items-center px-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Réinitialiser
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center">
          <p className="font-heading text-lg">
            {total === 0 ? "Journal vide." : "Aucun résultat pour ces filtres."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            {total === 0
              ? "Les actions admin et les événements de sécurité seront enregistrés ici dès qu'ils auront lieu."
              : "Élargissez la période ou changez l'action filtrée."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {rows.map((r) => (
            <li key={r.id} className="py-3">
              <div className="grid grid-cols-[auto_1fr_auto] gap-x-6 items-baseline">
                <span className="font-heading text-sm tracking-tight whitespace-nowrap">
                  {labelForAction(r.action)}
                </span>
                <span className="text-sm text-muted-foreground truncate min-w-0">
                  {r.actorName ?? r.actorEmail ?? <em>système</em>}
                  {r.target && <span className="text-xs"> → {r.target}</span>}
                </span>
                <time className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleString("fr-FR")}
                </time>
              </div>
              {r.meta != null && Object.keys(r.meta as object).length > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground/80 font-mono break-all">
                  {Object.entries(r.meta as Record<string, unknown>)
                    .map(([k, v]) => `${k}: ${String(v)}`)
                    .join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-sm">
          {page > 0 ? (
            <Link
              href={pageQs(page - 1)}
              className="inline-flex h-9 items-center rounded-md border border-border px-3 hover:bg-accent transition-colors"
            >
              ← Précédent
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            Page {page + 1} / {totalPages}
          </span>
          {page + 1 < totalPages ? (
            <Link
              href={pageQs(page + 1)}
              className="inline-flex h-9 items-center rounded-md border border-border px-3 hover:bg-accent transition-colors"
            >
              Suivant →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
