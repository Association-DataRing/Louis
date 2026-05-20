import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

/**
 * Page de connexion (Server Component).
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
  return <LoginForm />;
}
