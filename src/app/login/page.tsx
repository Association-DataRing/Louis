import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { LouisLogo } from "@/components/louis-logo";
import { instanceIsFresh } from "@/lib/setup/status";
import { LoginForm } from "./login-form";
import { LoginAside } from "./login-aside";

/**
 * Page de connexion (Server Component) — split screen : formulaire à gauche,
 * panneau de marque à droite (masqué sous `lg`).
 *
 * Si l'utilisateur a une session valide, on le renvoie directement vers
 * /chat (évite un crochet "connexion → reconnexion" inutile).
 *
 * Sinon, on affiche le formulaire. Les cookies authjs.* résiduels
 * (chiffrés avec un AUTH_SECRET précédent et donc indéchiffrables) sont
 * purgés en amont par src/proxy.ts qui intercepte toute requête vers
 * /login — un Server Component n'a pas le droit de muter les cookies
 * pendant le rendering, c'est le rôle du middleware/proxy.
 */
export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/chat");

  // Instance fraîche (zéro utilisateur) → assistant de premier lancement.
  if (await instanceIsFresh()) redirect("/setup");

  const t = await getTranslations("login.page");

  return (
    <main className="grid min-h-dvh flex-1 lg:grid-cols-[1fr_1.15fr]">
      <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-16">
        <header>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <LouisLogo className="size-6 text-primary" />
            <span className="font-heading text-lg tracking-tight">Louis</span>
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center py-12">
          <LoginForm />
        </div>

        <footer className="text-center text-xs text-muted-foreground lg:text-left">
          {t("footer")}
        </footer>
      </div>

      <LoginAside />
    </main>
  );
}
