import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import {
  IconShieldLock,
  IconClock,
  IconCheck,
  IconReceipt,
} from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { connectorKeys, type ConnectorKey } from "@/db/schema";
import {
  CONNECTOR_TYPES,
  type ConnectorType,
} from "@/lib/connectors/catalog";
import { ConnectorCard } from "./connector-card";
import { ModuleHelp } from "@/components/module-help";

// Connecteurs prévus dans la roadmap mais pas encore implémentés. Affichés
// en cartes "Bientôt" pour montrer où va le produit.
const COMING_SOON: Array<{
  label: string;
  description: string;
  category: "official" | "commercial";
}> = [
  {
    label: "Doctrine",
    category: "commercial",
    description: "Jurisprudence + doctrine enrichie, recherche sémantique.",
  },
  {
    label: "Lefebvre Dalloz",
    category: "commercial",
    description: "Encyclopédies, codes commentés, actualité juridique.",
  },
  {
    label: "INPI direct",
    category: "official",
    description: "Marques, brevets, RNCS — accès direct sans PISTE.",
  },
];

export default async function ConnectorsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

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
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-3xl tracking-tight">
            Connecteurs juridiques
          </h1>
          <ModuleHelp slug="configuration/connectors" title="Brancher vos sources de droit">
            PISTE donne accès à Légifrance ; Pappers aux données entreprises.
            Vos identifiants restent chiffrés sur votre instance. Vous pouvez
            aussi brancher n&apos;importe quel serveur MCP.
          </ModuleHelp>
        </div>
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

      <section className="mb-10">
        <h2 className="font-heading text-xl tracking-tight mb-4">
          Disponibles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CONNECTOR_TYPES.map((type) => (
            <ConnectorCard
              key={type}
              type={type}
              keys={keysByType.get(type) ?? []}
            />
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-heading text-xl tracking-tight mb-4">
          Open data — toujours actif
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OpenDataCard
            label="BODACC"
            category="official"
            description="Annonces civiles et commerciales : créations, modifications, radiations, ventes/cessions et procédures collectives. Source DILA en données ouvertes — aucune configuration requise."
            href="https://www.bodacc.fr"
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-heading text-xl tracking-tight mb-4">
          Bientôt
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COMING_SOON.map((c) => (
            <ComingSoonCard key={c.label} {...c} />
          ))}
        </div>
      </section>
    </main>
  );
}

function ComingSoonCard({
  label,
  description,
  category,
}: {
  label: string;
  description: string;
  category: "official" | "commercial";
}) {
  return (
    <div className="border border-dashed border-border rounded-lg p-5 bg-muted/20 flex flex-col gap-3 opacity-70">
      <div className="flex items-center gap-2">
        <h3 className="font-heading text-base tracking-tight">{label}</h3>
        <span className="text-[10px] text-muted-foreground rounded-full bg-muted px-2 py-0.5">
          {category === "official" ? "Officiel" : "Commercial"}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground rounded-full bg-muted px-2 py-0.5">
          <IconClock className="size-2.5" />
          Bientôt
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

// Sources en données ouvertes : aucune authentification, donc actives en
// permanence et sans carte de configuration. Affichées pour que l'utilisateur
// sache qu'elles existent et que Louis peut les interroger directement.
function OpenDataCard({
  label,
  description,
  category,
  href,
}: {
  label: string;
  description: string;
  category: "official" | "commercial";
  href?: string;
}) {
  return (
    <div className="border border-border rounded-lg p-5 bg-card flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <IconReceipt className="size-4 text-muted-foreground shrink-0" />
        <h3 className="font-heading text-base tracking-tight">{label}</h3>
        <span className="text-[10px] text-muted-foreground rounded-full bg-muted px-2 py-0.5">
          {category === "official" ? "Officiel" : "Commercial"}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-success rounded-full bg-success/10 px-2 py-0.5">
          <IconCheck className="size-2.5" />
          Toujours actif
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
      <p className="text-[11px] text-muted-foreground">
        Données ouvertes — aucune configuration requise.
        {href && (
          <>
            {" "}
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              En savoir plus
            </a>
          </>
        )}
      </p>
    </div>
  );
}
