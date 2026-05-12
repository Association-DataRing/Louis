import Link from "next/link";
import { IconKey, IconPlugConnected, IconMessageCircle, IconArrowRight } from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const tiles = [
  {
    href: "/providers",
    icon: IconKey,
    title: "Providers IA",
    description: "Connectez vos clés Mistral, Scaleway, OVH, Albert ou autres.",
    cta: "Configurer",
    enabled: true,
  },
  {
    href: "/connectors",
    icon: IconPlugConnected,
    title: "Connecteurs juridiques",
    description: "PISTE, Légifrance, Judilibre, Pappers — vos accès, vos quotas.",
    cta: "Bientôt",
    enabled: false,
  },
  {
    href: "/chat",
    icon: IconMessageCircle,
    title: "Conversations",
    description: "Discutez avec vos providers, sur vos documents, avec vos sources.",
    cta: "Discuter",
    enabled: true,
  },
];

export default function DashboardPage() {
  return (
    <main className="px-8 py-10 max-w-5xl">
      <header className="mb-10">
        <h1 className="font-heading text-3xl tracking-tight">Bienvenue</h1>
        <p className="mt-2 text-muted-foreground">
          Configurez votre instance Louis. Commencez par connecter au moins un provider IA.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          const card = (
            <Card className="h-full transition-colors hover:bg-accent/40">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Icon className="size-5 text-primary" />
                  {!tile.enabled && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      bientôt
                    </span>
                  )}
                </div>
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
          );

          return tile.enabled ? (
            <Link key={tile.href} href={tile.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={tile.href} className="cursor-not-allowed opacity-60">
              {card}
            </div>
          );
        })}
      </div>
    </main>
  );
}
