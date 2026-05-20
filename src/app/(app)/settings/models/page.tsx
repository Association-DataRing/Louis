import { eq } from "drizzle-orm";
import {
  IconAdjustmentsAlt,
  IconCircleCheck,
  IconCircleDashed,
} from "@tabler/icons-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { providerKeys } from "@/db/schema";
import { PROVIDER_CATALOG, type ProviderType } from "@/lib/providers/catalog";
import { MODEL_CATALOG } from "@/lib/providers/models";
import { getDisabledModelKeys } from "./actions";
import { ModelToggle } from "./model-toggle";

export default async function ModelsSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  // Détecte les providers actifs (clé active) → on ne montre que les
  // modèles utilisables. Pas la peine d'afficher GPT-4o si l'utilisateur
  // n'a pas configuré OpenAI.
  const activeKeys = await db
    .select({
      type: providerKeys.type,
      isActive: providerKeys.isActive,
    })
    .from(providerKeys)
    .where(eq(providerKeys.userId, userId));

  const activeTypes = new Set<ProviderType>(
    activeKeys.filter((k) => k.isActive).map((k) => k.type)
  );

  const disabledKeys = await getDisabledModelKeys(userId);

  // Construit la liste : un bloc par provider type ACTIF.
  const sections = (Object.keys(MODEL_CATALOG) as ProviderType[])
    .filter((t) => activeTypes.has(t))
    .map((t) => ({
      type: t,
      meta: PROVIDER_CATALOG[t],
      models: MODEL_CATALOG[t],
    }));

  const totalModels = sections.reduce((n, s) => n + s.models.length, 0);
  const disabledCount = disabledKeys.size;
  const enabledCount = totalModels - disabledCount;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-6">
        <p className="text-xs text-foreground/70 uppercase tracking-wider">
          Catalogue de modèles
        </p>
        <h1 className="mt-1 font-heading text-3xl tracking-tight">
          Modèles disponibles
        </h1>
        <p className="mt-2 text-muted-foreground max-w-2xl text-sm">
          Activez ou désactivez les modèles à votre disposition. Seuls les
          modèles activés apparaîtront dans les sélecteurs de Chat et du
          Bureau. Vos configurations existantes ne sont pas modifiées —
          un agent qui pointait sur un modèle désactivé continue de
          fonctionner mais vous ne pourrez plus en sélectionner d&apos;autres.
        </p>
      </header>

      <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={IconAdjustmentsAlt}
          label="Total disponibles"
          value={totalModels}
          hint="parmi vos providers connectés"
        />
        <StatCard
          icon={IconCircleCheck}
          label="Activés"
          value={enabledCount}
          hint="utilisables en Chat et /bureau"
        />
        <StatCard
          icon={IconCircleDashed}
          label="Désactivés"
          value={disabledCount}
          hint="masqués des sélecteurs"
        />
      </div>

      {sections.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.type}>
              <div className="mb-3 flex items-baseline justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-xl tracking-tight">
                    {section.meta.label}
                  </h2>
                  <span className="text-[10px] uppercase tracking-wider text-foreground/70 border border-border rounded-full px-1.5 py-0.5">
                    {section.meta.sovereignty.toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {
                    section.models.filter(
                      (m) => !disabledKeys.has(`${section.type}:${m.id}`)
                    ).length
                  }{" "}
                  / {section.models.length} activés
                </span>
              </div>

              <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
                <ul className="divide-y divide-border">
                  {section.models.map((model) => {
                    const key = `${section.type}:${model.id}`;
                    const enabled = !disabledKeys.has(key);
                    return (
                      <li
                        key={model.id}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">
                              {model.label}
                            </span>
                            <code className="text-[11px] text-muted-foreground font-mono">
                              {model.id}
                            </code>
                          </div>
                          {model.hint && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {model.hint}
                            </p>
                          )}
                        </div>
                        <ModelToggle
                          providerType={section.type}
                          modelId={model.id}
                          enabled={enabled}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          ))}
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
  icon: typeof IconAdjustmentsAlt;
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
    <div className="py-12 border-y border-dashed border-border">
      <p className="font-heading text-xl tracking-tight">
        Aucun provider actif.
      </p>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        Configurez d&apos;abord au moins un provider dans{" "}
        <a
          href="/settings/providers"
          className="underline underline-offset-2"
        >
          Réglages › Providers
        </a>{" "}
        pour voir apparaître son catalogue de modèles ici.
      </p>
    </div>
  );
}
