import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { AddMcpDialog } from "./add-mcp-dialog";
import { McpRow } from "./mcp-row";

export default async function McpPage() {
  const session = await auth();
  const userId = session!.user.id;

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
          <h1 className="font-heading text-3xl tracking-tight">Serveurs MCP</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Branchez vos propres serveurs Model Context Protocol pour
            étendre Louis avec vos outils maison ou ceux de la
            communauté — sans modifier le code source.
          </p>
        </div>
        <AddMcpDialog />
      </header>

      {totalCount > 0 && (
        <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            {totalCount} serveur{totalCount > 1 ? "s" : ""}
          </Badge>
          <Badge variant="outline">
            {activeCount} actif{activeCount > 1 ? "s" : ""}
          </Badge>
          {totalTools > 0 && (
            <Badge variant="default">
              {totalTools} outil{totalTools > 1 ? "s" : ""} en cache
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

function EmptyState() {
  return (
    <div className="border border-dashed border-border rounded-lg p-10 text-center">
      <h2 className="font-heading text-lg">Aucun serveur MCP</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        Connectez un serveur Model Context Protocol pour offrir à
        Louis des outils supplémentaires (recherche interne,
        documents intranet, base CRM, n&apos;importe quoi).
      </p>
    </div>
  );
}

function McpExplanation() {
  return (
    <aside className="mt-10 border-l-2 border-primary/50 pl-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">
        Qu&apos;est-ce qu&apos;un serveur MCP ?
      </p>
      <p className="mt-1 max-w-3xl">
        Le <a
          href="https://modelcontextprotocol.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          Model Context Protocol
        </a>{" "}
        est un standard ouvert permettant aux LLM d&apos;appeler des outils
        externes. Vous pouvez écrire un serveur MCP qui expose vos APIs
        internes, votre wiki, votre CRM, et le brancher ici sans
        modifier Louis. Transport supporté en v0.1 : SSE et HTTP streamable.
      </p>
    </aside>
  );
}
