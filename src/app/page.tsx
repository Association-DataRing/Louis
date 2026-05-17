import Link from "next/link";
import { LouisLogo } from "@/components/louis-logo";
import {
  IconBrandGithub,
  IconTerminal2,
  IconKey,
  IconCircleCheck,
  IconArrowRight,
  IconArrowUpRight,
  IconQuote,
} from "@tabler/icons-react";

/**
 * Landing publique — pattern SaaS classique :
 *  - Nav fixe top
 *  - Hero centré avec titre serif géant + vidéo qui peek du bas
 *  - Citation institutionnelle (Ulpien)
 *  - Architecture split asymétrique (BYOK + terminal mock)
 *  - Souveraineté providers FR / UE / US
 *  - Manifeste 5 cards sur section dark
 *  - Footer institutionnel
 *
 * Design généré via AIDesigner (run d7b753f3) puis porté manuellement
 * avec les tokens du repo (oklch bleu de France, EB Garamond + Geist,
 * Tabler icons, dark mode complet). Voir `.aidesigner/run-d7b753f3.notes.md`.
 */
export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col">
      <NavBar />
      <main className="pt-24 pb-0 overflow-hidden relative">
        <Hero />
        <Quote />
        <Architecture />
        <Sovereignty />
      </main>
      <Manifesto />
      <Footer />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav

function NavBar() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="mx-auto max-w-7xl px-4 md:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-foreground">
          <LouisLogo className="size-5 text-primary" />
          <span className="font-heading font-medium text-xl tracking-tight">
            Louis
          </span>
          <span className="hidden sm:inline-block ml-2 text-[10px] font-mono text-muted-foreground border border-border px-1.5 py-0.5 rounded leading-none">
            by DataRing
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#manifeste" className="hover:text-foreground transition-colors">
            Manifeste
          </a>
          <a
            href="#architecture"
            className="hover:text-foreground transition-colors"
          >
            Architecture
          </a>
          <a
            href="#souverainete"
            className="hover:text-foreground transition-colors"
          >
            Souveraineté
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="https://github.com/D4kooo/louis"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
          >
            <IconBrandGithub className="size-4" />
            <span className="hidden sm:inline">Dépôt AGPL-3.0</span>
          </Link>
          <Link
            href="/login"
            className="h-9 px-4 bg-foreground text-background hover:opacity-90 text-sm font-medium rounded-md transition-opacity flex items-center"
          >
            Se connecter
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero

function Hero() {
  return (
    <section className="mx-auto max-w-7xl px-4 md:px-8 text-center flex flex-col items-center justify-start relative">
      {/* Grille décorative fond */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.04] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:40px_40px] [mask-image:linear-gradient(to_bottom,black_20%,transparent_80%)]"
      />

      {/* Badge état */}
      <div className="mt-12 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted border border-border text-xs font-mono font-medium text-muted-foreground">
        <span className="size-1.5 rounded-full bg-success animate-pulse" />
        v0.1.0 — Alpha publique · open-source
      </div>

      {/* Titre */}
      <h1 className="mt-8 max-w-4xl font-heading text-5xl md:text-7xl lg:text-[5.5rem] leading-[1.05] tracking-tight text-foreground">
        L&apos;intelligence juridique
        <br className="hidden md:block" />{" "}
        <span className="italic text-primary">strictement souveraine.</span>
      </h1>

      {/* Tagline */}
      <p className="mt-8 max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed">
        Apportez vos clés (BYOK). Conservez vos données sur votre
        infrastructure. L&apos;IA open-source pensée pour l&apos;exigence et la
        confidentialité des professions du droit.
      </p>

      {/* CTAs */}
      <div className="mt-10 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
        <Link
          href="https://github.com/D4kooo/louis"
          className="w-full sm:w-auto h-12 px-6 bg-primary text-primary-foreground hover:opacity-90 text-base font-medium rounded-lg shadow-[0_4px_14px_-2px_color-mix(in_oklch,var(--primary)_40%,transparent)] transition-opacity flex items-center justify-center gap-2"
        >
          <IconBrandGithub className="size-5" />
          Voir le code source
        </Link>
        <Link
          href="#architecture"
          className="w-full sm:w-auto h-12 px-6 bg-card border border-border hover:border-foreground/20 hover:bg-accent text-foreground text-base font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <IconTerminal2 className="size-5 text-muted-foreground" />
          Lire le code
        </Link>
      </div>

      {/* Container vidéo qui bleed sous le titre — démo Louis générée par
          Remotion (cf. remotion/compositions/LouisDemo.tsx). 12s loop seamless.
          Poster JPG affiché avant chargement / sur réseaux lents.
          La vidéo est purement décorative — un figcaption sr-only décrit
          la démo pour les lecteurs d'écran. */}
      <figure className="relative z-10 mt-16 md:mt-20 w-full max-w-6xl">
        <div className="rounded-[20px] border border-border overflow-hidden bg-card shadow-[0_40px_100px_-20px_color-mix(in_oklch,var(--primary)_18%,transparent),0_0_0_1px_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/hero-poster.jpg"
            aria-labelledby="hero-demo-caption"
            className="block w-full aspect-[16/9]"
          >
            <source src="/hero-demo.mp4" type="video/mp4" />
          </video>
        </div>
        <figcaption id="hero-demo-caption" className="sr-only">
          Démonstration de Louis : un avocat pose une question juridique
          dans le chat, Louis appelle automatiquement le connecteur
          Légifrance, puis ouvre un panneau latéral qui affiche l&apos;article
          du Code civil cité avec la phrase exacte surlignée.
        </figcaption>
      </figure>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote

function Quote() {
  return (
    <section className="mx-auto max-w-4xl px-4 md:px-8 py-24 md:py-32 text-center">
      <div className="inline-block mb-6 text-muted-foreground/40">
        <IconQuote className="size-10" />
      </div>
      <h2 className="font-heading text-3xl md:text-5xl italic text-foreground leading-tight">
        « Justicia est constans et perpetua voluntas jus suum cuique
        tribuendi. »
      </h2>
      <div className="mt-8 flex flex-col items-center gap-1 text-sm">
        <span className="font-medium text-foreground uppercase tracking-widest text-xs">
          Ulpien
        </span>
        <span className="text-muted-foreground">Digeste, 1, 1, 10</span>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Architecture — split asymétrique

function Architecture() {
  return (
    <section
      id="architecture"
      className="mx-auto max-w-7xl px-4 md:px-8 py-16 border-t border-border"
    >
      <div className="mb-16">
        <h3 className="font-heading text-3xl md:text-4xl text-foreground mb-4 inline-block border-b-2 border-primary pb-2">
          Contrôle absolu.
        </h3>
        <p className="text-muted-foreground text-lg max-w-2xl mt-4">
          La confiance ne se décrète pas, elle se vérifie. Louis inverse le
          paradigme du SaaS&nbsp;: le moteur vient à vos données, pas
          l&apos;inverse.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-stretch">
        {/* Carte BYOK 7/12 */}
        <div className="lg:col-span-7">
          <div className="bg-card border border-border p-8 md:p-12 h-full flex flex-col relative group rounded-lg">
            <div
              aria-hidden
              className="absolute top-0 right-0 size-16 border-l border-b border-border/50 bg-muted/30 rounded-bl-lg rounded-tr-lg transition-colors group-hover:bg-primary/5"
            />
            <IconKey className="size-10 text-muted-foreground mb-6 group-hover:text-primary transition-colors" />

            <h4 className="font-heading text-2xl text-foreground mb-3">
              Bring Your Own Key (BYOK)
            </h4>
            <p className="text-muted-foreground leading-relaxed mb-6">
              L&apos;architecture de Louis garantit que vos clés
              providers — qu&apos;il s&apos;agisse de modèles
              auto-hébergés ou d&apos;API Cloud — restent chiffrées sur{" "}
              <strong className="text-foreground">
                votre propre instance PostgreSQL
              </strong>{" "}
              (AES-256-GCM avec IV+tag par ciphertext). Aucune clé ne
              transite par DataRing.
            </p>

            <ul className="mt-auto space-y-2.5 border-t border-border pt-6">
              <li className="flex items-center gap-2.5 text-sm text-foreground">
                <IconCircleCheck className="size-4 text-primary" />
                Aucune télémétrie sortante.
              </li>
              <li className="flex items-center gap-2.5 text-sm text-foreground">
                <IconCircleCheck className="size-4 text-primary" />
                Stockage documentaire S3 local ou privé (MinIO, Scaleway,
                OVH).
              </li>
              <li className="flex items-center gap-2.5 text-sm text-foreground">
                <IconCircleCheck className="size-4 text-primary" />
                Embeddings calculés et stockés localement (pgvector).
              </li>
            </ul>
          </div>
        </div>

        {/* Terminal .env 5/12 */}
        <div className="lg:col-span-5">
          <ArchTerminal />
        </div>
      </div>
    </section>
  );
}

function ArchTerminal() {
  return (
    <div className="bg-zinc-950 dark:bg-card rounded-lg p-1 h-full shadow-2xl relative overflow-hidden border border-zinc-900 dark:border-border">
      <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-800 dark:border-border">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-zinc-700 dark:bg-border" />
          <span className="size-2.5 rounded-full bg-zinc-700 dark:bg-border" />
          <span className="size-2.5 rounded-full bg-zinc-700 dark:bg-border" />
        </div>
        <span className="text-[10px] font-mono text-zinc-500 dark:text-muted-foreground uppercase tracking-widest">
          .env.production
        </span>
      </div>

      <pre className="p-6 font-mono text-xs leading-relaxed overflow-x-auto text-zinc-300 dark:text-foreground/80">
        <span className="text-zinc-500"># Infrastructure (chez vous)</span>
        {"\n"}
        <span className="text-sky-400">DATABASE_URL</span>=
        <span className="text-zinc-400">
          &quot;postgresql://louis:***@db.cabinet.local:5432/louis&quot;
        </span>
        {"\n"}
        <span className="text-sky-400">S3_ENDPOINT</span>=
        <span className="text-zinc-400">
          &quot;https://s3.cabinet.local&quot;
        </span>
        {"\n"}
        <span className="text-sky-400">S3_BUCKET</span>=
        <span className="text-zinc-400">
          &quot;legal-docs-encrypted&quot;
        </span>
        {"\n\n"}
        <span className="text-zinc-500">
          # Secrets maîtres (jamais en DB)
        </span>
        {"\n"}
        <span className="text-emerald-400">ENCRYPTION_KEY</span>=
        <span className="text-zinc-400">&quot;</span>
        <span className="inline-block align-middle h-3 w-32 bg-gradient-to-r from-zinc-800 via-zinc-600 to-zinc-800 rounded animate-pulse" />
        <span className="text-zinc-400">&quot;</span>
        {"\n\n"}
        <span className="text-zinc-500">
          # Souveraineté par défaut
        </span>
        {"\n"}
        <span className="text-sky-400">DEFAULT_PROVIDER</span>=
        <span className="text-zinc-400">&quot;mistral&quot;</span>
        {"\n"}
      </pre>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Souveraineté providers

function Sovereignty() {
  return (
    <section
      id="souverainete"
      className="mx-auto max-w-7xl px-4 md:px-8 py-24 border-t border-border"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
        <div className="md:col-span-1 pr-0 md:pr-8">
          <h3 className="font-heading text-3xl md:text-4xl text-foreground mb-6">
            Écosystème neutre, agnostique.
          </h3>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Ne soyez plus captifs d&apos;un fournisseur californien. Louis
            est conçu pour s&apos;interfacer prioritairement avec les
            acteurs de la souveraineté française et européenne, tout en
            restant compatible avec les standards US.
          </p>
          <Link
            href="https://github.com/D4kooo/louis/tree/main/docs/configuration/providers.md"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80 transition-opacity group"
          >
            Voir le tableau comparatif
            <IconArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="md:col-span-2 border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {/* FR / UE */}
            <div className="p-6 border-b sm:border-b-0 sm:border-r border-border hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <h5 className="font-medium text-foreground">
                  Acteurs FR / UE
                </h5>
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider rounded border border-primary/20">
                  Recommandé
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Hébergement européen soumis au droit de l&apos;UE.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <ProviderChip label="Mistral" />
                <ProviderChip label="Scaleway" />
                <ProviderChip label="OVHcloud" />
                <ProviderChip label="Albert · Etalab" />
              </div>
            </div>

            {/* US */}
            <div className="p-6 border-b sm:border-b-0 border-border hover:bg-muted/40 transition-colors">
              <h5 className="font-medium text-foreground mb-2">
                Providers US
              </h5>
              <p className="text-sm text-muted-foreground mb-4">
                Compatibilité as-is. Badge US affiché dans l&apos;app pour
                garder la traçabilité.
              </p>
              <div className="flex flex-wrap gap-1.5 opacity-80">
                <ProviderChip label="OpenAI" muted />
                <ProviderChip label="Anthropic" muted />
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-border hidden sm:block" />

          {/* Self-hosted */}
          <div className="p-6 hover:bg-muted/40 transition-colors">
            <h5 className="font-medium text-foreground mb-2">
              Modèles auto-hébergés (open-weights)
            </h5>
            <p className="text-sm text-muted-foreground mb-3 max-w-2xl">
              Exécutez Llama, Mistral, Qwen ou tout modèle compatible OpenAI
              via Ollama, vLLM ou llama.cpp sur vos propres GPU. Zéro
              donnée ne transite par le réseau public.
            </p>
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-muted-foreground" />
              <span className="text-xs font-mono text-muted-foreground">
                Ollama · vLLM · llama.cpp · endpoint OpenAI-compatible
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProviderChip({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span
      className={`text-xs font-semibold px-3 py-1 bg-card border border-border rounded-full ${
        muted ? "" : "shadow-sm"
      }`}
    >
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Manifeste 5 cards — section dark (toujours dark, mode-agnostique)

function Manifesto() {
  const items = [
    {
      n: "01",
      title: "Vos clés, pas les nôtres",
      body: "BYOK sur tous les providers — Mistral, Scaleway, OVH, Albert, Anthropic, OpenAI, ou tout endpoint OpenAI-compatible. Clés chiffrées AES-256-GCM sur votre instance.",
    },
    {
      n: "02",
      title: "Vos connecteurs juridiques",
      body: "PISTE / Légifrance, Pappers — vous configurez vos accès, vos quotas, vos contrats. Louis orchestre, n'intermédie pas.",
    },
    {
      n: "03",
      title: "Vos données, chez vous",
      body: "PostgreSQL local, pgvector local, fichiers sur votre stockage S3-compatible. Aucun appel sortant vers DataRing. Aucune télémétrie.",
    },
    {
      n: "04",
      title: "Licence AGPL-3.0",
      body: "Code lisible, modifiable, auditable. Toute amélioration apportée à une instance publique doit revenir à la communauté. Il n'y aura jamais de version premium cachée du moteur.",
    },
    {
      n: "05",
      title: "Souverain par défaut",
      body: "Fournisseurs français et européens en première ligne. Providers US disponibles mais optionnels, avec badge FR / UE / US visible partout dans l'app.",
    },
  ];

  return (
    <section
      id="manifeste"
      className="bg-zinc-950 text-zinc-50 py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="mb-16">
          <span className="text-sky-400 font-mono text-xs uppercase tracking-widest mb-4 block">
            Licence & déploiement
          </span>
          <h2 className="font-heading text-4xl md:text-6xl text-white max-w-4xl">
            Le logiciel libre au service du droit.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-x-8 gap-y-12">
          {items.map((item) => (
            <div key={item.n} className="border-t border-zinc-800 pt-6">
              <div className="text-3xl text-zinc-700 mb-4 font-heading tabular-nums">
                {item.n}.
              </div>
              <h4 className="text-lg font-medium mb-3">{item.title}</h4>
              <p className="text-zinc-400 text-sm leading-relaxed">
                {item.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-20 flex flex-col sm:flex-row items-center justify-between border-t border-zinc-800 pt-8 gap-6">
          <p className="text-zinc-500 text-sm">
            Prêt à évaluer le code sur votre infrastructure&nbsp;?
          </p>
          <Link
            href="https://github.com/D4kooo/louis"
            className="h-12 px-8 bg-white hover:bg-zinc-200 text-zinc-950 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            Accéder au dépôt GitHub
            <IconArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer

function Footer() {
  return (
    <footer className="bg-background border-t border-border pt-16 pb-8">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 mb-16">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <LouisLogo className="size-5 text-primary" />
              <span className="font-heading font-medium text-lg tracking-tight">
                Louis
              </span>
            </div>
            <p className="text-muted-foreground text-sm max-w-sm">
              L&apos;intelligence artificielle au service des professions
              juridiques françaises. Auto-hébergée, transparente, souveraine.
            </p>
          </div>

          <div>
            <h6 className="text-foreground font-medium mb-4 text-sm">Projet</h6>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link
                  href="https://github.com/D4kooo/louis"
                  className="hover:text-primary transition-colors"
                >
                  Dépôt GitHub
                </Link>
              </li>
              <li>
                <Link
                  href="https://github.com/D4kooo/louis/tree/main/docs"
                  className="hover:text-primary transition-colors"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  href="https://github.com/D4kooo/louis/blob/main/docs/installation/docker-compose.md"
                  className="hover:text-primary transition-colors"
                >
                  Guide de déploiement
                </Link>
              </li>
              <li>
                <Link
                  href="https://github.com/D4kooo/louis/blob/main/docs/feature-status.md"
                  className="hover:text-primary transition-colors"
                >
                  État des fonctionnalités
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h6 className="text-foreground font-medium mb-4 text-sm">
              Légal & contact
            </h6>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://data-ring.net"
                  className="hover:text-primary transition-colors"
                >
                  Association DataRing
                </a>
              </li>
              <li>
                <Link
                  href="/legal"
                  className="hover:text-primary transition-colors"
                >
                  Mentions légales
                </Link>
              </li>
              <li>
                <Link
                  href="https://github.com/D4kooo/louis/blob/main/LICENSE"
                  className="hover:text-primary transition-colors"
                >
                  Licence AGPL-3.0
                </Link>
              </li>
              <li>
                <a
                  href="mailto:contact@data-ring.net"
                  className="hover:text-primary transition-colors"
                >
                  contact@data-ring.net
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground font-mono">
          <p>
            © 2026 Association DataRing — Code sous licence GNU AGPL-3.0-or-later.
          </p>
          <div className="flex items-center gap-2">
            <span>v0.1.0 alpha</span>
            <span className="size-1.5 rounded-full bg-success animate-pulse" />
          </div>
        </div>
      </div>
    </footer>
  );
}
