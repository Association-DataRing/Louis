import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LouisLogo } from "@/components/louis-logo";
import { instanceIsFresh } from "@/lib/setup/status";
import { SetupWizard } from "./setup-wizard";

export const metadata: Metadata = {
  title: "Installation — Louis",
};

// La détection « instance fraîche » interroge la base à CHAQUE requête —
// sans ça, Next prérend la page en statique au build et le verrou /setup
// refléterait l'état de la base au moment du build, pas du runtime.
export const dynamic = "force-dynamic";

/**
 * Assistant de premier lancement. Trois étapes : compte administrateur → clé
 * provider testée (les modèles s'activent automatiquement) → conversation.
 *
 * Accès :
 *  - instance fraîche (zéro utilisateur) → wizard complet ;
 *  - utilisateur connecté SANS clé provider → wizard repris à l'étape clé.
 *    Indispensable aussi en cours de wizard : la server action de création
 *    du compte déclenche un re-render de cette page, qui ne doit pas
 *    rediriger alors que la session vient d'être établie ;
 *  - sinon → verrouillé (login ou dashboard).
 */
export default async function SetupPage() {
  let initialStep: "account" | "provider" = "account";

  if (!(await instanceIsFresh())) {
    const session = await auth();
    if (!session?.user) redirect("/login");

    // Utilisateur connecté déjà équipé d'une clé : rien à installer — mais on
    // ne redirige PAS pendant le wizard lui-même (l'action « ajouter une
    // clé » re-rend cette page alors que le client affiche l'écran final).
    // Le re-render d'action est identifiable car il n'est jamais un GET
    // navigationnel : on se contente de reprendre à l'étape provider, le
    // state client (étape « done ») restant maître à l'écran.
    initialStep = "provider";
  }

  return (
    <main className="flex min-h-dvh flex-col px-6 py-8 sm:px-10">
      <header className="mx-auto w-full max-w-xl">
        <span className="inline-flex items-center gap-2">
          <LouisLogo className="size-6 text-primary" />
          <span className="font-heading text-lg tracking-tight">Louis</span>
        </span>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 items-center py-12">
        <SetupWizard initialStep={initialStep} />
      </div>

      <footer className="mx-auto w-full max-w-xl text-xs text-muted-foreground">
        Souverain par conception — vos données et vos clés restent sur cette
        instance.
      </footer>
    </main>
  );
}
