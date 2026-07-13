import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { IconShieldLock } from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { providerKeys, type ProviderKey } from "@/db/schema";
import { type ProviderType } from "@/lib/providers/catalog";
import { ModuleHelp } from "@/components/module-help";
import { ProviderCard } from "./provider-card";

type Group = {
  id: string;
  types: ProviderType[];
};

const groups: Group[] = [
  {
    id: "souverains",
    types: ["mistral", "scaleway", "ovh", "albert"],
  },
  {
    id: "international",
    types: ["anthropic", "openai"],
  },
  {
    id: "agregateurs",
    types: ["openrouter"],
  },
  {
    id: "selfHosted",
    types: ["openai_compatible"],
  },
];

export default async function ProvidersPage() {
  const t = await getTranslations("settings.providers");
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const allKeys = await db
    .select()
    .from(providerKeys)
    .where(eq(providerKeys.userId, userId))
    .orderBy(desc(providerKeys.isDefault), desc(providerKeys.createdAt));

  const keysByType = new Map<ProviderType, ProviderKey[]>();
  for (const k of allKeys) {
    if (!keysByType.has(k.type)) keysByType.set(k.type, []);
    keysByType.get(k.type)!.push(k);
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-3xl tracking-tight">{t("heading")}</h1>
          <ModuleHelp slug="configuration/providers" title={t("moduleHelp.title")}>
            {t.rich("moduleHelp.body", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </ModuleHelp>
        </div>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          {t.rich("intro", { strong: (chunks) => <strong>{chunks}</strong> })}
        </p>
      </header>

      {/* Security banner */}
      <div className="mb-8 rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <IconShieldLock className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">{t("security.title")}</p>
          <p className="mt-1 text-muted-foreground">
            {t.rich("security.body", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </div>
      </div>

      {groups.map((group) => (
        <section key={group.id} className="mb-10 last:mb-0">
          <div className="mb-4 flex items-baseline justify-between gap-4 flex-wrap">
            <h2 className="font-heading text-xl tracking-tight">
              {t(`groups.${group.id}.title`)}
            </h2>
            <p className="text-xs text-muted-foreground max-w-xl text-right">
              {t(`groups.${group.id}.subtitle`)}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.types.map((type) => (
              <ProviderCard
                key={type}
                type={type}
                keys={keysByType.get(type) ?? []}
              />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
