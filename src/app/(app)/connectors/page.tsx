import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { connectorKeys } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { AddConnectorDialog } from "./add-connector-dialog";
import { ConnectorRow } from "./connector-row";

export default async function ConnectorsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const keys = await db
    .select()
    .from(connectorKeys)
    .where(eq(connectorKeys.userId, userId))
    .orderBy(desc(connectorKeys.createdAt));

  const totalCount = keys.length;
  const activeCount = keys.filter((k) => k.isActive).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">
            Connecteurs juridiques
          </h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Branchez vos accès aux sources de droit français — vos
            credentials, vos quotas, vos contrats. Louis ne s&apos;interpose
            pas.
          </p>
        </div>
        <AddConnectorDialog />
      </header>

      {totalCount > 0 && (
        <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{totalCount} connecteur{totalCount > 1 ? "s" : ""}</Badge>
          <Badge variant="outline">
            {activeCount} actif{activeCount > 1 ? "s" : ""}
          </Badge>
        </div>
      )}

      {totalCount === 0 ? (
        <EmptyState />
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border bg-card">
          {keys.map((key) => (
            <ConnectorRow key={key.id} entry={key} />
          ))}
        </div>
      )}

      <UseCasesNote />
    </main>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-border rounded-lg p-10 text-center">
      <h2 className="font-heading text-lg">Aucun connecteur configuré</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        Commencez par <strong>PISTE</strong> — la passerelle officielle{" "}
        <code className="text-xs">api.gouv.fr</code> qui débloque
        Légifrance, Judilibre, JADE et l&apos;INPI en une seule
        configuration.
      </p>
    </div>
  );
}

function UseCasesNote() {
  return (
    <aside className="mt-10 border-l-2 border-primary/50 pl-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">À quoi servent-ils ?</p>
      <p className="mt-1 max-w-3xl">
        Les connecteurs permettront à Louis d&apos;aller chercher des textes,
        de la jurisprudence et des données d&apos;entreprises{" "}
        <em>directement dans vos sources</em>, à l&apos;intérieur d&apos;une
        conversation. Cette intégration sera ouverte progressivement à
        partir de la v0.3.
      </p>
    </aside>
  );
}
