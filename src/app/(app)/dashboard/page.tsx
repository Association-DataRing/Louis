import Link from "next/link";
import {
  IconKey,
  IconPlugConnected,
  IconMessageCircle,
  IconArrowRight,
  IconFolder,
  IconBolt,
} from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const tiles = [
  {
    href: "/providers",
    icon: IconKey,
    title: "Providers IA",
    description: "Connectez vos clés Mistral, Scaleway, OVH, Albert ou autres.",
    cta: "Configurer",
  },
  {
    href: "/connectors",
    icon: IconPlugConnected,
    title: "Connecteurs juridiques",
    description: "PISTE, Légifrance, Judilibre, Pappers — vos accès, vos quotas.",
    cta: "Configurer",
  },
  {
    href: "/documents",
    icon: IconFolder,
    title: "Documents",
    description: "Importez vos PDF/DOCX, attachez-les aux conversations.",
    cta: "Importer",
  },
  {
    href: "/mcp",
    icon: IconBolt,
    title: "Serveurs MCP",
    description: "Branchez vos outils maison via Model Context Protocol.",
    cta: "Configurer",
  },
  {
    href: "/chat",
    icon: IconMessageCircle,
    title: "Conversations",
    description: "Discutez avec vos providers, vos documents, vos sources.",
    cta: "Discuter",
  },
];

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-10">
        <h1 className="font-heading text-3xl tracking-tight">Bienvenue</h1>
        <p className="mt-2 text-muted-foreground">
          Configurez votre instance Louis. Commencez par connecter au moins un provider IA.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.href} href={tile.href} className="block">
              <Card className="h-full transition-colors hover:bg-accent/40">
                <CardHeader>
                  <Icon className="size-5 text-primary" />
                  <CardTitle className="font-heading mt-3">{tile.title}</CardTitle>
                  <CardDescription>{tile.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    {tile.cta}
                    <IconArrowRight className="size-3.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
