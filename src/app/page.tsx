import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <OakLogo className="size-6 text-primary" />
            <span className="font-heading text-lg tracking-tight">Louis</span>
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#manifeste" className="hover:text-foreground transition-colors">Manifeste</a>
            <a href="#fonctionnalites" className="hover:text-foreground transition-colors">Fonctionnalités</a>
            <a href="#souverainete" className="hover:text-foreground transition-colors">Souveraineté</a>
            <Link
              href="https://github.com/D4kooo/louis"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </Link>
          </nav>
        </div>
      </header>

      <section className="flex-1 flex items-center">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            Open-source · AGPL-3.0 · Auto-hébergeable
          </div>
          <h1 className="mt-6 font-heading text-5xl sm:text-6xl tracking-tight text-balance">
            L&apos;IA juridique souveraine,
            <br />
            sous votre contrôle.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground text-balance">
            Louis est une plateforme IA open-source pour les professions juridiques.
            Vos clés API, vos connecteurs, vos données — rien ne transite par un tiers.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link
              href="https://github.com/D4kooo/louis"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Voir sur GitHub
            </Link>
            <a
              href="#manifeste"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              Lire le manifeste
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Un projet initié par{" "}
            <a href="https://altij.com" className="underline-offset-2 hover:underline">
              Altij Avocats
            </a>
            .
          </span>
          <span>AGPL-3.0 · Hébergé chez vous, par vous.</span>
        </div>
      </footer>
    </main>
  );
}

function OakLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 21V13" />
      <path d="M9 21h6" />
      <path d="M12 13c0-3 2-4 4-4 1.5 0 3-1 3-3 0-1.5-1-3-3-3-1.5 0-2.5 1-3 2-.5-1-1.5-2-3-2-2 0-3 1.5-3 3 0 2 1.5 3 3 3 2 0 4 1 4 4Z" />
    </svg>
  );
}
