import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { count } from "drizzle-orm";
import {
  IconMessageCircle,
  IconFileText,
  IconFolders,
  IconTable,
  IconShield,
} from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  users,
  conversations,
  documents,
  projects,
  tabularReviews,
} from "@/db/schema";
import { NameForm } from "./name-form";
import { PasswordForm } from "./password-form";

export default async function ProfilePage() {
  const t = await getTranslations("settings.profile");
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const [user] = await db
    .select({
      email: users.email,
      name: users.name,
      role: users.role,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [convCount, docCount, projCount, reviewCount] = await Promise.all([
    db
      .select({ n: count() })
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .then((r) => r[0].n),
    db
      .select({ n: count() })
      .from(documents)
      .where(eq(documents.userId, userId))
      .then((r) => r[0].n),
    db
      .select({ n: count() })
      .from(projects)
      .where(eq(projects.userId, userId))
      .then((r) => r[0].n),
    db
      .select({ n: count() })
      .from(tabularReviews)
      .where(eq(tabularReviews.userId, userId))
      .then((r) => r[0].n),
  ]);

  const initials = (user?.name || user?.email || "?").slice(0, 1).toUpperCase();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8 md:px-8 md:py-10">
      {/* Header with avatar + identity */}
      <header className="mb-10 flex items-center gap-5 flex-wrap">
        <div className="size-20 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-medium">
          {initials}
        </div>
        <div className="min-w-0">
          <h1 className="font-heading text-3xl tracking-tight">
            {user?.name ?? "—"}
          </h1>
          <p className="text-sm text-muted-foreground font-mono">
            {user?.email ?? "—"}
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {user?.role === "admin" && (
              <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                <IconShield className="size-2.5" />
                {t("badge.admin")}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {t("createdAt", { date: formatDate(user?.createdAt) })}
            </span>
            {user?.lastLogin && (
              <span className="text-[10px] text-muted-foreground">
                {t("lastLogin", { date: formatDate(user.lastLogin) })}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Stats grid */}
      <section className="mb-10">
        <h2 className="font-heading text-lg tracking-tight mb-3">
          {t("sections.activity")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={IconMessageCircle}
            label={t("stats.conversations")}
            value={convCount}
          />
          <StatCard
            icon={IconFolders}
            label={t("stats.projects")}
            value={projCount}
          />
          <StatCard
            icon={IconFileText}
            label={t("stats.documents")}
            value={docCount}
          />
          <StatCard
            icon={IconTable}
            label={t("stats.reviews")}
            value={reviewCount}
          />
        </div>
      </section>

      {/* Identité */}
      <section className="mb-10">
        <h2 className="font-heading text-lg tracking-tight mb-3">
          {t("sections.identity")}
        </h2>
        <div className="border border-border rounded-lg bg-card p-5">
          <NameForm initialName={user?.name ?? ""} />
        </div>
      </section>

      {/* Sécurité */}
      <section>
        <h2 className="font-heading text-lg tracking-tight mb-3">
          {t("sections.security")}
        </h2>
        <div className="border border-border rounded-lg bg-card p-5">
          <PasswordForm />
        </div>
      </section>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof IconMessageCircle;
  label: string;
  value: number;
}) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="font-heading text-2xl tracking-tight mt-1 tabular-nums">
        {value}
      </div>
    </div>
  );
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
