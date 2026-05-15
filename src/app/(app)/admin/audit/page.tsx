import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/permissions";

const ACTION_LABEL: Record<string, string> = {
  "user.create": "Utilisateur créé",
  "user.update": "Utilisateur modifié",
  "user.disable": "Utilisateur désactivé",
  "user.enable": "Utilisateur réactivé",
  "user.delete": "Utilisateur supprimé",
  "user.role": "Rôle modifié",
  "provider.add": "Clé provider ajoutée",
  "provider.delete": "Clé provider supprimée",
  "provider.toggle": "Clé provider activée/désactivée",
  "connector.add": "Connecteur ajouté",
  "connector.delete": "Connecteur supprimé",
  "doc.delete": "Document supprimé",
  "cabinet.update": "Configuration cabinet modifiée",
  "auth.login": "Connexion",
  "auth.login.failed": "Échec de connexion",
};

export default async function AdminAuditPage() {
  await requireAdmin();
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
    .orderBy(desc(auditLog.createdAt))
    .limit(200);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-8 md:py-12">
      <header className="mb-10">
        <h1 className="font-heading text-3xl tracking-tight">
          Journal d&apos;audit
        </h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          200 dernières actions enregistrées : créations/modifications de
          comptes, MAJ providers, suppressions, événements d&apos;authentification.
          Append-only.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center">
          <p className="font-heading text-lg">Journal vide.</p>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Les actions admin et les événements de sécurité seront enregistrés
            ici dès qu&apos;ils auront lieu.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {rows.map((r) => (
            <li
              key={r.id}
              className="py-3 grid grid-cols-[auto_1fr_auto] gap-x-6 items-baseline"
            >
              <span className="font-heading text-sm tracking-tight whitespace-nowrap">
                {ACTION_LABEL[r.action] ?? r.action}
              </span>
              <span className="text-sm text-muted-foreground truncate min-w-0">
                {r.actorName ?? r.actorEmail ?? <em>système</em>}
                {r.target && (
                  <>
                    {" "}
                    <span className="text-xs">→ {r.target}</span>
                  </>
                )}
              </span>
              <time className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                {new Date(r.createdAt).toLocaleString("fr-FR")}
              </time>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
