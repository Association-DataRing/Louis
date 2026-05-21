import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { IconShieldLock, IconInfoCircle } from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { providerKeys, type ProviderKey } from "@/db/schema";
import { type ProviderType } from "@/lib/providers/catalog";
import { ProviderCard } from "./provider-card";

type Group = {
  title: string;
  subtitle: string;
  types: ProviderType[];
};

const groups: Group[] = [
  {
    title: "Souverains",
    subtitle: "Hébergés en France ou par l'État. Privilégiez ces providers pour les dossiers couverts par le secret professionnel.",
    types: ["mistral", "scaleway", "ovh", "albert"],
  },
  {
    title: "International",
    subtitle: "Modèles américains les plus capables. Vérifiez vos engagements contractuels avant d'envoyer des données sensibles.",
    types: ["anthropic", "openai"],
  },
  {
    title: "Agrégateurs",
    subtitle: "Une seule clé pour accéder au catalogue multi-providers (Claude, GPT, Mistral, Llama, Gemini…). Pratique comme fallback en cas de saturation d'un fournisseur.",
    types: ["openrouter"],
  },
  {
    title: "Self-hosted",
    subtitle: "Serveurs d'inférence auto-hébergés (Ollama, vLLM, llama.cpp, LiteLLM…) via API OpenAI-compatible.",
    types: ["openai_compatible"],
  },
];

export default async function ProvidersPage() {
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
        <h1 className="font-heading text-3xl tracking-tight">Gestion des clés API</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Connectez vos propres clés. Une seule règle : <strong>vos clés ne
          quittent jamais votre instance</strong>.
        </p>
      </header>

      {/* Security banner */}
      <div className="mb-8 rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <IconShieldLock className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">Sécurité des clés API</p>
          <p className="mt-1 text-muted-foreground">
            Toutes les clés sont chiffrées <strong>AES-256-GCM</strong> avant
            d&apos;être stockées en base. Le décryptage n&apos;intervient
            qu&apos;à l&apos;instant de l&apos;appel au provider, côté serveur.
            Aucun appel API n&apos;est relayé par un service tiers.
          </p>
        </div>
      </div>

      {groups.map((group) => (
        <section key={group.title} className="mb-10 last:mb-0">
          <div className="mb-4 flex items-baseline justify-between gap-4 flex-wrap">
            <h2 className="font-heading text-xl tracking-tight">{group.title}</h2>
            <p className="text-xs text-muted-foreground max-w-xl text-right">
              {group.subtitle}
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

      <aside className="mt-12 rounded-lg border border-border bg-card p-4 flex items-start gap-3 text-sm">
        <IconInfoCircle className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-muted-foreground">
          Le badge <strong>FR</strong> / <strong>UE</strong> / <strong>US</strong>{" "}
          sur chaque carte indique où sont traitées vos requêtes. Pour les
          dossiers soumis au secret professionnel ou au RGPD strict,
          privilégiez les providers FR ou UE. Louis ne force aucun choix :
          votre cabinet décide.
        </p>
      </aside>
    </main>
  );
}
