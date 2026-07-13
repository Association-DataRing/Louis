import { redirect } from "next/navigation";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  users,
  conversations,
  documents,
  projects,
  messages,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth/permissions";
import { aggregateCosts } from "@/lib/providers/pricing";
import { AddUserDialog } from "./add-user-dialog";
import { UsersTable } from "./users-table";

/**
 * Statistiques métier par utilisateur — calculées en parallèle pour ne
 * pas multiplier les round-trips DB. Le coût mensuel additionne tous les
 * messages assistant facturés depuis le 1er du mois courant.
 */
async function loadUserStats(userId: string, monthStart: Date) {
  const [convCount, docCount, projectCount, monthRows] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(documents)
      .where(eq(documents.userId, userId))
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(projects)
      .where(eq(projects.userId, userId))
      .then((r) => r[0]?.n ?? 0),
    db
      .select({
        modelId: messages.modelId,
        inputTokens: messages.inputTokens,
        outputTokens: messages.outputTokens,
      })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(
        and(
          eq(conversations.userId, userId),
          eq(messages.role, "assistant"),
          gte(messages.createdAt, monthStart)
        )
      ),
  ]);

  const monthCost = aggregateCosts(monthRows);

  // Dernière activité = max entre lastLogin et le dernier message assistant
  // produit. Permet de repérer les comptes dormants (créés mais jamais utilisés
  // ou inactifs depuis > 30 jours).
  const [lastMessage] = await db
    .select({ createdAt: sql<Date>`max(${messages.createdAt})` })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(eq(conversations.userId, userId));

  return {
    convCount,
    docCount,
    projectCount,
    monthCost,
    lastActivity: lastMessage?.createdAt ?? null,
  };
}

export default async function AdminUsersPage() {
  await requireAdmin();
  const t = await getTranslations("admin.users");
  const session = await auth();
  if (!session?.user) redirect("/login");
  const currentId = session.user.id;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
      monthlyQuotaCents: users.monthlyQuotaCents,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  // Snapshot du now côté server — propagé au client UsersTable pour le
  // filtre "dormant" (React Compiler interdit Date.now() pendant render).
  const nowMs = monthStart.getTime() === 0 ? 0 : new Date().getTime();

  // Stats en parallèle pour tous les users. Limite raisonnable car un
  // cabinet typique = 5-30 collaborateurs. Au-delà de 100 users il
  // faudrait une vue matérialisée — hors scope v0.1.
  const stats = await Promise.all(
    rows.map((u) => loadUserStats(u.id, monthStart))
  );
  const rowsWithStats = rows.map((u, i) => ({ ...u, stats: stats[i] }));

  // Agrégat global : total dépensé ce mois sur tous les users, nb actifs,
  // nb admins. Affiché en kicker en haut de la page — vue cabinet d'un
  // coup d'œil.
  const totalMonthCost = stats.reduce(
    (acc, s) => {
      acc.EUR += s.monthCost.EUR;
      acc.USD += s.monthCost.USD;
      return acc;
    },
    { EUR: 0, USD: 0 } as Record<"EUR" | "USD", number>
  );
  const activeCount = rows.filter((u) => u.isActive).length;
  const adminCount = rows.filter((u) => u.role === "admin").length;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            {t("subtitle")}
          </p>
        </div>
        <AddUserDialog />
      </header>

      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 border-y border-border py-5">
        <Stat label={t("statTotal")} value={rows.length.toString()} />
        <Stat label={t("statActive")} value={activeCount.toString()} />
        <Stat label={t("statAdmins")} value={adminCount.toString()} />
        <Stat
          label={t("statMonthCost")}
          value={
            totalMonthCost.EUR === 0 && totalMonthCost.USD === 0
              ? "—"
              : [
                  totalMonthCost.EUR > 0
                    ? `${totalMonthCost.EUR.toFixed(2).replace(".", ",")} €`
                    : null,
                  totalMonthCost.USD > 0
                    ? `${totalMonthCost.USD.toFixed(2).replace(".", ",")} $`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
          }
        />
      </div>

      <UsersTable
        rows={rowsWithStats}
        currentUserId={currentId}
        nowMs={nowMs}
      />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-heading text-2xl tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  );
}

