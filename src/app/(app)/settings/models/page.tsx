import Link from "next/link";
import { eq } from "drizzle-orm";
import {
  IconBooks,
  IconCircleCheck,
  IconCircleDashed,
} from "@tabler/icons-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { providerKeys } from "@/db/schema";
import { PROVIDER_CATALOG, type ProviderType } from "@/lib/providers/catalog";
import { Button } from "@/components/ui/button";
import { listEnabledModels } from "./actions";
import { RemoveModelButton } from "./model-toggle";
import { OrphansBanner } from "./orphans-banner";

export default async function MyModelsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const [enabled, keys] = await Promise.all([
    listEnabledModels(userId),
    db
      .select({ type: providerKeys.type, isActive: providerKeys.isActive })
      .from(providerKeys)
      .where(eq(providerKeys.userId, userId)),
  ]);

  const activeTypes = new Set<ProviderType>(
    keys.filter((k) => k.isActive).map((k) => k.type)
  );

  // Ne montre que les modèles ajoutés POUR un provider actuellement
  // connecté. Si l'utilisateur a désactivé sa clé Mistral, ses modèles
  // Mistral n'apparaissent plus dans la liste — on les considère
  // orphelins (gérés via le bouton "Nettoyer les modèles orphelins").
  const liveEnabled = enabled.filter((m) =>
    activeTypes.has(m.providerType as ProviderType)
  );
  const orphanCount = enabled.length - liveEnabled.length;

  // Groupe par provider type pour l'affichage.
  const byType = new Map<ProviderType, typeof liveEnabled>();
  for (const m of liveEnabled) {
    const t = m.providerType as ProviderType;
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(m);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-2xl">
          <p className="text-xs text-foreground/70 uppercase tracking-wider">
            Bibliothèque
          </p>
          <h1 className="mt-1 font-heading text-3xl tracking-tight">
            Mes modèles
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Les modèles que vous avez ajoutés à votre plateforme. Seuls ceux
            listés ici apparaissent dans les pickers du Chat et du Bureau.
            Parcourez la bibliothèque pour découvrir et ajouter de nouveaux
            modèles.
          </p>
        </div>
        <Button asChild variant="default" size="default">
          <Link href="/settings/models/library">
            <IconBooks className="size-4" />
            Explorer la bibliothèque
          </Link>
        </Button>
      </header>

      <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={IconCircleCheck}
          label="Modèles ajoutés"
          value={liveEnabled.length}
          hint="disponibles dans Chat & Bureau"
        />
        <StatCard
          icon={IconBooks}
          label="Providers actifs"
          value={activeTypes.size}
          hint="clés API configurées"
        />
        <StatCard
          icon={IconCircleDashed}
          label="Orphelins"
          value={orphanCount}
          hint="clé provider retirée — à nettoyer"
        />
      </div>

      {orphanCount > 0 && <OrphansBanner count={orphanCount} />}

      {liveEnabled.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {[...byType.entries()].map(([type, models]) => {
            const meta = PROVIDER_CATALOG[type];
            return (
              <section key={type}>
                <div className="mb-3 flex items-baseline justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-xl tracking-tight">
                      {meta.label}
                    </h2>
                    <span className="text-[10px] uppercase tracking-wider text-foreground/70 border border-border rounded-full px-1.5 py-0.5">
                      {meta.sovereignty.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {models.length} modèle{models.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
                  <ul className="divide-y divide-border">
                    {models.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm font-medium">
                              {m.label ?? m.modelId}
                            </span>
                            <code className="text-[11px] text-muted-foreground font-mono">
                              {m.modelId}
                            </code>
                          </div>
                          {m.hint && (
                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                              {m.hint}
                            </p>
                          )}
                        </div>
                        <RemoveModelButton
                          providerType={m.providerType}
                          modelId={m.modelId}
                          label={m.label ?? m.modelId}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof IconBooks;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-2 font-heading text-3xl tracking-tight">
        {value}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-12 border-y border-dashed border-border text-center">
      <p className="font-heading text-2xl tracking-tight">
        Aucun modèle ajouté.
      </p>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        Allez explorer la bibliothèque pour choisir les modèles que vous
        voulez rendre disponibles dans le Chat et le Bureau.
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/settings/models/library">
            <IconBooks className="size-4" />
            Ouvrir la bibliothèque
          </Link>
        </Button>
      </div>
    </div>
  );
}
