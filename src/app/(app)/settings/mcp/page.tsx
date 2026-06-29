import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { AddMcpDialog } from "./add-mcp-dialog";
import { McpRow } from "./mcp-row";

export default async function McpPage() {
  const t = await getTranslations("settings.mcp");
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const servers = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.userId, userId))
    .orderBy(desc(mcpServers.createdAt));

  const totalCount = servers.length;
  const activeCount = servers.filter((s) => s.isActive).length;
  const totalTools = servers.reduce(
    (n, s) => n + (s.toolsJson?.length ?? 0),
    0
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            {t("subtitle")}
          </p>
        </div>
        <AddMcpDialog />
      </header>

      {totalCount > 0 && (
        <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            {t("badge.servers", { count: totalCount })}
          </Badge>
          <Badge variant="outline">
            {t("badge.active", { count: activeCount })}
          </Badge>
          {totalTools > 0 && (
            <Badge variant="default">
              {t("badge.toolsCached", { count: totalTools })}
            </Badge>
          )}
        </div>
      )}

      {totalCount === 0 ? <EmptyState /> : null}
      {totalCount > 0 && (
        <div className="border border-border rounded-lg divide-y divide-border bg-card">
          {servers.map((server) => (
            <McpRow key={server.id} entry={server} />
          ))}
        </div>
      )}

      <McpExplanation />
    </main>
  );
}

async function EmptyState() {
  const t = await getTranslations("settings.mcp");
  return (
    <div className="border border-dashed border-border rounded-lg p-10 text-center">
      <h2 className="font-heading text-lg">{t("empty.title")}</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        {t("empty.description")}
      </p>
    </div>
  );
}

async function McpExplanation() {
  const t = await getTranslations("settings.mcp");
  return (
    <aside className="mt-10 border-l-2 border-primary/50 pl-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">
        {t("explanation.title")}
      </p>
      <p className="mt-1 max-w-3xl">
        {t.rich("explanation.body", {
          link: (chunks) => (
            <a
              href="https://modelcontextprotocol.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    </aside>
  );
}
