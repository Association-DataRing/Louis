import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
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
  id: string;
  label: string;
  category: "official" | "commercial";
}> = [
  {
    id: "doctrine",
    label: "Doctrine",
    category: "commercial",
  },
  {
    id: "lefebvre",
    label: "Lefebvre Dalloz",
    category: "commercial",
  },
  {
    id: "inpi",
    label: "INPI direct",
    category: "official",
  },
];

export default async function ConnectorsPage() {
  const t = await getTranslations("settings.connectors");
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
            {t("heading")}
          </h1>
          <ModuleHelp slug="configuration/connectors" title={t("moduleHelp.title")}>
            {t("moduleHelp.body")}
          </ModuleHelp>
        </div>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          {t("intro")}
        </p>
      </header>

      <div className="mb-8 rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <IconShieldLock className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">
            {t("security.title")}
          </p>
          <p className="mt-1 text-muted-foreground">
            {t.rich("security.body", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="font-heading text-xl tracking-tight mb-4">
          {t("sections.available")}
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
          {t("sections.openData")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OpenDataCard
            label="BODACC"
            category="official"
            description={t("openDataCard.bodacc.description")}
            href="https://www.bodacc.fr"
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-heading text-xl tracking-tight mb-4">
          {t("sections.comingSoon")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COMING_SOON.map((c) => (
            <ComingSoonCard
              key={c.id}
              label={c.label}
              category={c.category}
              description={t(`comingSoon.${c.id}.description`)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

async function ComingSoonCard({
  label,
  description,
  category,
}: {
  label: string;
  description: string;
  category: "official" | "commercial";
}) {
  const t = await getTranslations("settings.connectors");
  return (
    <div className="border border-dashed border-border rounded-lg p-5 bg-muted/20 flex flex-col gap-3 opacity-70">
      <div className="flex items-center gap-2">
        <h3 className="font-heading text-base tracking-tight">{label}</h3>
        <span className="text-[10px] text-muted-foreground rounded-full bg-muted px-2 py-0.5">
          {category === "official" ? t("category.official") : t("category.commercial")}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground rounded-full bg-muted px-2 py-0.5">
          <IconClock className="size-2.5" />
          {t("comingSoon.badge")}
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
async function OpenDataCard({
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
  const t = await getTranslations("settings.connectors");
  return (
    <div className="border border-border rounded-lg p-5 bg-card flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <IconReceipt className="size-4 text-muted-foreground shrink-0" />
        <h3 className="font-heading text-base tracking-tight">{label}</h3>
        <span className="text-[10px] text-muted-foreground rounded-full bg-muted px-2 py-0.5">
          {category === "official" ? t("category.official") : t("category.commercial")}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-success rounded-full bg-success/10 px-2 py-0.5">
          <IconCheck className="size-2.5" />
          {t("openData.alwaysActive")}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {t("openData.noConfig")}
        {href && (
          <>
            {" "}
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {t("openData.learnMore")}
            </a>
          </>
        )}
      </p>
    </div>
  );
}
