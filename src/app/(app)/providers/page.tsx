import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { providerKeys } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { PROVIDER_CATALOG, SOVEREIGNTY_LABEL } from "@/lib/providers/catalog";
import { AddProviderDialog } from "./add-provider-dialog";
import { ProviderRow } from "./provider-row";

export default async function ProvidersPage() {
  const session = await auth();
  const userId = session!.user.id;

  const keys = await db
    .select()
    .from(providerKeys)
    .where(eq(providerKeys.userId, userId))
    .orderBy(desc(providerKeys.createdAt));

  const sovereignCount = keys.filter(
    (k) => PROVIDER_CATALOG[k.type].sovereignty !== "us"
  ).length;
  const totalCount = keys.length;

  return (
    <main className="px-8 py-10 max-w-5xl">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Providers IA</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Connectez vos propres clés d&apos;API. Elles sont chiffrées au repos
            (AES-256-GCM) et ne quittent jamais votre serveur Louis.
          </p>
        </div>
        <AddProviderDialog />
      </header>

      {totalCount > 0 && (
        <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{totalCount} clé{totalCount > 1 ? "s" : ""}</Badge>
          <Badge variant="outline">
            {sovereignCount} souveraine{sovereignCount > 1 ? "s" : ""} ({SOVEREIGNTY_LABEL.fr}/{SOVEREIGNTY_LABEL.eu})
          </Badge>
        </div>
      )}

      {totalCount === 0 ? (
        <EmptyState />
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border bg-card">
          {keys.map((key) => (
            <ProviderRow key={key.id} entry={key} />
          ))}
        </div>
      )}

      <SovereigntyNote />
    </main>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-border rounded-lg p-10 text-center">
      <h2 className="font-heading text-lg">Aucun provider configuré</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        Louis n&apos;embarque aucun fournisseur IA par défaut. Ajoutez votre
        première clé pour commencer — privilégiez un provider souverain
        (Mistral, Scaleway, OVH, Albert).
      </p>
    </div>
  );
}

function SovereigntyNote() {
  return (
    <aside className="mt-10 border-l-2 border-primary/50 pl-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">À propos de la souveraineté</p>
      <p className="mt-1 max-w-3xl">
        Le badge FR / UE / US sur chaque provider indique où sont traitées vos
        requêtes. Pour les dossiers couverts par le secret professionnel ou
        soumis au RGPD strict, privilégiez les providers FR ou UE. Louis ne
        force aucun choix : votre cabinet décide.
      </p>
    </aside>
  );
}
