import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { desc, eq } from "drizzle-orm";
import { IconSparkles } from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { workflows } from "@/db/schema";
import { EmptyState } from "@/components/empty-state";
import { WorkflowCard } from "./workflow-card";
import { AddWorkflowDialog } from "./add-workflow-dialog";

export default async function WorkflowsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const t = await getTranslations("workflows");

  const list = await db
    .select()
    .from(workflows)
    .where(eq(workflows.userId, userId))
    .orderBy(desc(workflows.updatedAt));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-8 md:py-14">
      <header className="mb-10 flex items-end justify-between gap-4 flex-wrap">
        <div className="max-w-2xl">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {t("list.eyebrow")}
          </p>
          <h1 className="mt-2 font-heading text-4xl tracking-tight">
            {t("list.title")}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {t.rich("list.subtitle", {
              icon: () => (
                <IconSparkles className="inline size-3.5 align-text-bottom" />
              ),
            })}
          </p>
        </div>
        <AddWorkflowDialog />
      </header>

      {list.length === 0 ? (
        <EmptyState title={t("list.emptyTitle")}>
          <p>{t("list.emptyBody1")}</p>
          <p className="mt-3">
            {t.rich("list.emptyBody2", {
              link: (chunks) => (
                <Link
                  href="/settings/skills"
                  className="text-primary hover:underline underline-offset-2"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {list.map((w) => (
            <WorkflowCard key={w.id} workflow={w} />
          ))}
        </ul>
      )}
    </main>
  );
}
