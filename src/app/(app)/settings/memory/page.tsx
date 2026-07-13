import { desc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { projectMemories, projects } from "@/db/schema";
import { MemoryRow, type MemoryItem } from "./memory-row";

export default async function MemoryPage() {
  const t = await getTranslations("settings.memory");
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const rows = await db
    .select({
      id: projectMemories.id,
      category: projectMemories.category,
      text: projectMemories.text,
      status: projectMemories.status,
      projectName: projects.name,
    })
    .from(projectMemories)
    .innerJoin(projects, eq(projects.id, projectMemories.projectId))
    .where(eq(projectMemories.userId, userId))
    .orderBy(desc(projectMemories.createdAt));

  const pending = rows.filter((r) => r.status === "pending") as MemoryItem[];
  const approved = rows.filter((r) => r.status === "approved") as MemoryItem[];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-8 max-w-2xl">
        <p className="text-xs text-foreground/70 uppercase tracking-wider">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 font-heading text-3xl tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          {t.rich("description", {
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-lg px-4 py-8 text-center">
          {t.rich("empty", { code: (chunks) => <code>{chunks}</code> })}
        </p>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-medium mb-2">
              {t("pendingHeading")}{" "}
              <span className="text-muted-foreground">({pending.length})</span>
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">
                {t("pendingEmpty")}
              </p>
            ) : (
              <div className="border rounded-lg divide-y">
                {pending.map((m) => (
                  <MemoryRow key={m.id} memory={m} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-medium mb-2">
              {t("approvedHeading")}{" "}
              <span className="text-muted-foreground">({approved.length})</span>
            </h2>
            {approved.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">
                {t("approvedEmpty")}
              </p>
            ) : (
              <div className="border rounded-lg divide-y">
                {approved.map((m) => (
                  <MemoryRow key={m.id} memory={m} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
