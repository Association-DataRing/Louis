import { ThemePicker } from "./theme-picker";

export default function GeneralSettingsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 md:px-8 md:py-12">
      <header className="mb-10">
        <h1 className="font-heading text-3xl tracking-tight">Général</h1>
        <p className="mt-2 text-muted-foreground">
          Préférences globales de l&apos;application.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="font-heading text-lg tracking-tight mb-1">Apparence</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Thème de l&apos;interface. « Système » suit votre macOS / Windows.
        </p>
        <ThemePicker />
      </section>

      <section className="mb-12">
        <h2 className="font-heading text-lg tracking-tight mb-1">
          Souveraineté
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Louis n&apos;envoie aucune donnée à un serveur tiers Louis. Toutes
          les requêtes vers les providers IA partent directement de votre
          serveur avec vos propres clés. Le badge FR / UE / US affiché dans
          le chat indique d&apos;où sort la donnée à chaque message.
        </p>
      </section>

      <section className="border-l-2 border-primary/40 pl-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">À propos</p>
        <p>
          Louis · version alpha · AGPL-3.0 · Auto-hébergé. Vos données ne
          quittent jamais votre infrastructure sauf via les providers IA que
          vous configurez explicitement.
        </p>
      </section>
    </main>
  );
}
