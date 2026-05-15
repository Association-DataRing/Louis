import Link from "next/link";
import { LouisLogo } from "@/components/louis-logo";
import { IconArrowUpRight } from "@tabler/icons-react";

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
    <header className="sticky top-0 z-10 border-b border-border bg-background">
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
    <section className="relative border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32 grid lg:grid-cols-[1.4fr_1fr] gap-12 items-start">
        <div>
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            Open-source · AGPL-3.0 · Auto-hébergeable
          </div>
          <h1 className="mt-6 font-heading text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[0.95]">
            L&apos;IA juridique
            <br />
            <span className="italic font-light">souveraine.</span>
          </h1>
          <p className="mt-8 text-lg text-foreground/80 max-w-xl leading-relaxed">
            Vos clés, vos connecteurs, vos documents. Rien ne transite par un
            tiers — la réponse française à Mike OSS.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Se connecter
            </Link>
            <Link
              href="https://github.com/D4kooo/louis"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Voir sur GitHub
              <IconArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* Carte d'aparté à droite : pas une grille de tiles, juste UNE
            citation qui ancre le ton du produit. */}
        <aside className="lg:mt-2 lg:border-l lg:border-border lg:pl-8">
          <blockquote className="text-sm leading-relaxed text-muted-foreground">
            <p className="font-heading italic text-base text-foreground">
              « Justicia est constans et perpetua voluntas jus suum cuique
              tribuendi. »
            </p>
            <footer className="mt-3 text-xs">
              Ulpien · <em>Digeste</em> 1.1.10
            </footer>
          </blockquote>
          <p className="mt-8 text-xs text-muted-foreground">
            Un projet initié par{" "}
            <a
              href="https://altij.com"
              className="underline-offset-2 hover:underline text-foreground"
            >
              Altij Avocats
            </a>
            .
          </p>
        </aside>
      </div>
    </section>
  );
}

/**
 * Manifeste — sortie volontaire de la grille de cartes : 3 paragraphes
 * numérotés en colonne. Asymétrie (le n° à gauche, le texte qui occupe la
 * largeur), pas d'icônes-au-dessus-du-titre.
 */
function Manifesto() {
  const items = [
    {
      n: "01",
      title: "Vos clés, pas les nôtres",
      body: "BYOK sur tous les providers IA — Mistral, Scaleway, OVH, Albert, Anthropic, OpenAI, ou tout endpoint OpenAI-compatible. Chaque clé est chiffrée AES-256-GCM avant stockage. Aucun appel n'est relayé par un serveur Louis.",
    },
    {
      n: "02",
      title: "Vos connecteurs juridiques",
      body: "PISTE, Légifrance, Judilibre, JADE, INPI, Pappers — vous configurez vos accès, vos quotas, vos contrats. Louis orchestre, n'intermédie pas.",
    },
    {
      n: "03",
      title: "Souverain par défaut",
      body: "Les providers français et européens sont en première ligne. Les providers américains restent disponibles mais optionnels. Un badge FR/UE/US accompagne chaque clé pour ne jamais perdre la trace de ce qui sort.",
    },
  ];
  return (
    <section id="manifeste" className="border-b border-border bg-card/30">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid lg:grid-cols-[280px_1fr] gap-12">
          <h2 className="font-heading text-3xl tracking-tight">
            Le manifeste.
          </h2>
          <div className="space-y-12">
            {items.map((item) => (
              <div
                key={item.n}
                className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-b border-border last:border-0 pb-12 last:pb-0"
              >
                <span className="font-heading text-2xl text-muted-foreground tabular-nums leading-none mt-1">
                  {item.n}
                </span>
                <h3 className="font-heading text-xl tracking-tight">
                  {item.title}
                </h3>
                <span aria-hidden />
                <p className="text-muted-foreground leading-relaxed max-w-2xl">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * 4 étapes — liste numérotée en colonne, pas une grille de cartes 2×2 ou
 * 1×4. La densité varie selon le contenu.
 */
function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Configurez vos providers.",
      body: "Mistral, Scaleway, OVH, Albert, Anthropic, OpenAI, ou un endpoint local (Ollama, vLLM). Chiffrement automatique, test de connexion intégré.",
    },
    {
      n: "02",
      title: "Branchez vos connecteurs.",
      body: "PISTE débloque Légifrance, Judilibre, JADE, INPI en une seule configuration. Ajoutez Pappers pour les données entreprises.",
    },
    {
      n: "03",
      title: "Importez vos documents.",
      body: "PDF, DOCX, texte. Texte extrait, indexé en pgvector. Stocké sur votre infrastructure (S3, MinIO, OVH Object Storage).",
    },
    {
      n: "04",
      title: "Discutez.",
      body: "Choisissez votre provider par conversation, joignez vos documents, laissez l'IA appeler vos connecteurs. Le badge de souveraineté reste visible.",
    },
  ];
  return (
    <section id="fonctionnement" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="font-heading text-3xl tracking-tight max-w-md">
          Quatre étapes.
        </h2>
        <ol className="mt-12 divide-y divide-border max-w-3xl">
          {steps.map((s) => (
            <li
              key={s.n}
              className="grid grid-cols-[auto_1fr] gap-x-6 py-6"
            >
              <span className="font-heading text-sm text-muted-foreground tabular-nums pt-1">
                {s.n}
              </span>
              <div>
                <h3 className="font-heading text-lg tracking-tight">
                  {s.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Audience() {
  const audiences = [
    {
      title: "Cabinets d'avocats",
      body: "Un outil IA partagé entre vos collaborateurs, sans envoyer vos dossiers clients chez un éditeur SaaS.",
    },
    {
      title: "Directions juridiques",
      body: "Un déploiement on-premises pour respecter votre politique de sécurité et vos engagements contractuels.",
    },
    {
      title: "Juristes indépendants",
      body: "Un outil installé en local, totalement sous votre contrôle, sans abonnement SaaS récurrent.",
    },
  ];
  return (
    <section id="audience" className="border-b border-border bg-card/30">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid lg:grid-cols-[280px_1fr] gap-12">
          <h2 className="font-heading text-3xl tracking-tight">Pour qui.</h2>
          <dl className="grid sm:grid-cols-3 gap-x-8 gap-y-8">
            {audiences.map((a) => (
              <div key={a.title}>
                <dt className="font-heading text-base tracking-tight">
                  {a.title}
                </dt>
                <dd className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {a.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function CallToAction() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-20 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h2 className="font-heading text-3xl sm:text-4xl tracking-tight max-w-md">
            Prêts à essayer Louis ?
          </h2>
          <p className="mt-3 text-muted-foreground max-w-md">
            Louis est en alpha — installable en local en quelques minutes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 sm:shrink-0">
          <Link
            href="https://github.com/D4kooo/louis"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Voir le repo
            <IconArrowUpRight className="size-3.5" />
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            J&apos;ai déjà une instance →
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <LouisLogo className="size-4 text-primary" />
          <span>Louis · AGPL-3.0 · Hébergé chez vous, par vous.</span>
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
