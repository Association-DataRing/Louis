import { desc, eq } from "drizzle-orm";
import { IconBrain } from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { projectMemories, projects } from "@/db/schema";
import { MemoryRow, type MemoryItem } from "./memory-row";

export default async function MemoryPage() {
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
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <IconBrain className="size-5" />
        <h1 className="text-lg font-semibold">Mémoire des dossiers</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Faits durables extraits de vos conversations, par dossier (parties,
        échéances, conventions de rédaction…). Un fait n&apos;influence les
        réponses qu&apos;une fois <strong>validé</strong> par vous — rien
        n&apos;est utilisé automatiquement. Chaque fait reste rattaché à son
        dossier (jamais partagé entre clients).
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-lg px-4 py-8 text-center">
          Aucun fait mémorisé pour l&apos;instant. L&apos;extraction automatique
          s&apos;active via <code>LOUIS_MEMORY_EXTRACTION=1</code>.
        </p>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-medium mb-2">
              À valider{" "}
              <span className="text-muted-foreground">({pending.length})</span>
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">
                Rien en attente.
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
              Validés{" "}
              <span className="text-muted-foreground">({approved.length})</span>
            </h2>
            {approved.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">
                Aucun fait validé.
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
    </div>
  );
}
