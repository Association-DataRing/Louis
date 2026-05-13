import { desc, eq } from "drizzle-orm";
import { IconShieldLock, IconInfoCircle } from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { connectorKeys, type ConnectorKey } from "@/db/schema";
import { type ConnectorType } from "@/lib/connectors/catalog";
import { ConnectorCard } from "./connector-card";

type Group = {
  title: string;
  subtitle: string;
  types: ConnectorType[];
};

const groups: Group[] = [
  {
    title: "Officiels",
    subtitle:
      "Passerelles institutionnelles api.gouv.fr — sources de droit français de référence.",
    types: ["piste"],
  },
  {
    title: "Commerciaux",
    subtitle:
      "Bases B2B avec compte payant — données structurées entreprises, jurisprudence enrichie, etc.",
    types: ["pappers"],
  },
];

export default async function ConnectorsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const allKeys = await db
    .select()
    .from(connectorKeys)
    .where(eq(connectorKeys.userId, userId))
    .orderBy(desc(connectorKeys.createdAt));

  const keysByType = new Map<ConnectorType, ConnectorKey[]>();
  for (const k of allKeys) {
    if (!keysByType.has(k.type)) keysByType.set(k.type, []);
    keysByType.get(k.type)!.push(k);
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-6">
        <h1 className="font-heading text-3xl tracking-tight">
          Connecteurs juridiques
        </h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Branchez vos accès aux sources de droit français. Vos identifiants,
          vos quotas, vos contrats — Louis ne s&apos;interpose pas.
        </p>
      </header>

      <div className="mb-8 rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <IconShieldLock className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">
            Sécurité des identifiants
          </p>
          <p className="mt-1 text-muted-foreground">
            Les identifiants (client_id, client_secret, tokens API) sont chiffrés{" "}
            <strong>AES-256-GCM</strong> avant d&apos;être stockés en base.
            L&apos;authentification auprès des APIs externes se fait
            exclusivement depuis votre serveur Louis.
          </p>
        </div>
      </div>

      {groups.map((group) => (
        <section key={group.title} className="mb-10 last:mb-0">
          <div className="mb-4 flex items-baseline justify-between gap-4 flex-wrap">
            <h2 className="font-heading text-xl tracking-tight">
              {group.title}
            </h2>
            <p className="text-xs text-muted-foreground max-w-xl text-right">
              {group.subtitle}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.types.map((type) => (
              <ConnectorCard
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
          Les connecteurs configurés sont automatiquement disponibles comme
          outils dans les conversations. L&apos;IA peut appeler Légifrance,
          Judilibre ou Pappers depuis le chat et citer les sources directement
          dans ses réponses.
        </p>
      </aside>
    </main>
  );
}
