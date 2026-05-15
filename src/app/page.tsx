import Link from "next/link";
import { LouisLogo } from "@/components/louis-logo";
import {
  IconShieldLock,
  IconFlag,
  IconKey,
  IconPlugConnected,
  IconMessageCircle,
  IconFileText,
  IconBriefcase,
  IconScale,
  IconUser,
} from "@tabler/icons-react";

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col">
      <Header />
      <Hero />
      <Manifesto />
      <HowItWorks />
      <Audience />
      <CallToAction />
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LouisLogo className="size-6 text-primary" />
          <span className="font-heading text-lg tracking-tight">Louis</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#manifeste" className="hover:text-foreground transition-colors">
            Manifeste
          </a>
          <a href="#fonctionnement" className="hover:text-foreground transition-colors">
            Fonctionnement
          </a>
          <a href="#audience" className="hover:text-foreground transition-colors">
            Pour qui
          </a>
          <Link
            href="https://github.com/D4kooo/louis"
            className="hover:text-foreground transition-colors"
          >
            GitHub
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90"
          >
            Se connecter
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-3xl px-6 py-24 sm:py-32 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          Open-source · AGPL-3.0 · Auto-hébergeable
        </div>
        <h1 className="mt-6 font-heading text-5xl sm:text-6xl tracking-tight text-balance">
          L&apos;IA juridique souveraine,
          <br />
          sous votre contrôle.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground text-balance leading-relaxed">
          Louis est une plateforme IA open-source pour les professions juridiques.
          Vos clés API, vos connecteurs juridiques, vos documents — rien ne
          transite par un tiers.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Se connecter
          </Link>
          <Link
            href="https://github.com/D4kooo/louis"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            Voir sur GitHub
          </Link>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          Un projet initié par{" "}
          <a href="https://altij.com" className="underline-offset-2 hover:underline text-foreground">
            Altij Avocats
          </a>
          .
        </p>
      </div>
    </section>
  );
}

const manifestoItems = [
  {
    icon: IconShieldLock,
    title: "Vos clés, pas les nôtres",
    body: "Bring Your Own Key sur tous les providers IA. Chaque clé est chiffrée AES-256-GCM avant stockage. Aucun appel n'est relayé par un serveur Louis.",
  },
  {
    icon: IconPlugConnected,
    title: "Vos connecteurs juridiques",
    body: "PISTE, Légifrance, Judilibre, JADE, INPI, Pappers — vous configurez vos accès, vos quotas, vos contrats. Louis n'est pas intermédiaire.",
  },
  {
    icon: IconFlag,
    title: "Souverain par défaut",
    body: "Mistral, Scaleway, OVH, Albert d'Etalab en première ligne. Les providers américains restent disponibles mais optionnels. Badge FR/UE/US sur chaque clé.",
  },
];

function Manifesto() {
  return (
    <section id="manifeste" className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl sm:text-4xl tracking-tight">
            Le manifeste
          </h2>
          <p className="mt-4 text-muted-foreground text-balance">
            Les outils d&apos;IA juridique imposent un choix : confier vos
            données clients à un SaaS américain, ou renoncer à l&apos;IA.
            Louis propose une troisième voie.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {manifestoItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-lg border border-border bg-background p-6"
              >
                <Icon className="size-5 text-primary" />
                <h3 className="mt-4 font-heading text-lg tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {item.body}
                </p>
              </div>
            );
          })}
        </div>

        <blockquote className="mt-12 border-l-2 border-primary pl-4 max-w-3xl text-muted-foreground">
          <p className="italic">
            « Justicia est constans et perpetua voluntas jus suum cuique
            tribuendi. »
          </p>
          <footer className="mt-2 text-xs">
            — Ulpien, <em>Digeste</em> 1.1.10.
          </footer>
        </blockquote>
      </div>
    </section>
  );
}

const steps = [
  {
    icon: IconKey,
    n: "1",
    title: "Configurez vos providers",
    body: "Ajoutez vos clés Mistral, Scaleway, OVH, Albert, Anthropic ou tout endpoint OpenAI-compatible. Chiffrement automatique, test de connexion intégré.",
  },
  {
    icon: IconPlugConnected,
    n: "2",
    title: "Branchez vos connecteurs",
    body: "PISTE débloque Légifrance, Judilibre, JADE, INPI en une seule configuration. Ajoutez Pappers pour les données entreprises. Toujours BYOK.",
  },
  {
    icon: IconFileText,
    n: "3",
    title: "Importez vos documents",
    body: "PDF, DOCX, texte. Le texte est extrait côté serveur et stocké sur votre infrastructure (S3, MinIO, OVH Object Storage…).",
  },
  {
    icon: IconMessageCircle,
    n: "4",
    title: "Discutez",
    body: "Choisissez votre provider par conversation, joignez vos documents, laissez l'IA appeler vos connecteurs. Le badge de souveraineté reste visible.",
  },
];

function HowItWorks() {
  return (
    <section id="fonctionnement" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl sm:text-4xl tracking-tight">
            Comment ça marche
          </h2>
          <p className="mt-4 text-muted-foreground">
            Quatre étapes — chacune entièrement sous votre contrôle.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.n}
                className="rounded-lg border border-border bg-card/40 p-6"
              >
                <div className="flex items-center justify-between">
                  <Icon className="size-5 text-primary" />
                  <span className="font-heading text-xl text-muted-foreground/60">
                    {step.n}
                  </span>
                </div>
                <h3 className="mt-4 font-heading text-base tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {step.body}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 rounded-lg border border-border bg-card p-6 max-w-3xl">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Stack technique
          </p>
          <p className="mt-2 text-sm">
            Next.js 16 · React 19 · PostgreSQL + pgvector · Drizzle ORM ·
            NextAuth v5 · Vercel AI SDK v6 · S3-compatible · Redis ·
            Docker Compose
          </p>
        </div>
      </div>
    </section>
  );
}

const audiences = [
  {
    icon: IconBriefcase,
    title: "Cabinets d'avocats",
    body: "Vous voulez un outil IA partagé entre vos collaborateurs, sans envoyer vos dossiers clients chez un éditeur SaaS.",
  },
  {
    icon: IconScale,
    title: "Directions juridiques",
    body: "Vous avez besoin d'un déploiement on-premises pour respecter votre politique de sécurité et vos engagements contractuels.",
  },
  {
    icon: IconUser,
    title: "Juristes indépendants",
    body: "Vous voulez un outil que vous installez en local, que vous contrôlez totalement, sans abonnement SaaS récurrent.",
  },
];

function Audience() {
  return (
    <section id="audience" className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl sm:text-4xl tracking-tight">
            Pour qui ?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Louis vise les professions juridiques qui ne peuvent ou ne
            veulent pas confier leurs données à un tiers.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {audiences.map((a) => {
            const Icon = a.icon;
            return (
              <div
                key={a.title}
                className="rounded-lg border border-border bg-background p-6"
              >
                <Icon className="size-5 text-primary" />
                <h3 className="mt-4 font-heading text-lg tracking-tight">
                  {a.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {a.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CallToAction() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="font-heading text-3xl sm:text-4xl tracking-tight">
          Prêts à essayer Louis ?
        </h2>
        <p className="mt-4 text-muted-foreground">
          Louis est en alpha. Vous pouvez déjà l&apos;installer en local,
          configurer vos providers, et tester le chat.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="https://github.com/D4kooo/louis"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Voir le repo GitHub
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            J&apos;ai déjà une instance
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <LouisLogo className="size-4 text-primary/70" />
          <span>
            Louis · AGPL-3.0 · Hébergé chez vous, par vous.
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="hover:text-foreground">
            Connexion
          </Link>
          <Link
            href="https://github.com/D4kooo/louis"
            className="hover:text-foreground"
          >
            GitHub
          </Link>
          <a href="mailto:contact@altij.com" className="hover:text-foreground">
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}

