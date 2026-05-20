import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

/**
 * Page de connexion (Server Component).
 *
 * Trois cas à gérer :
 *  1. L'utilisateur est déjà connecté → on le renvoie vers /chat.
 *  2. L'utilisateur n'a aucun cookie → on affiche le formulaire normalement.
 *  3. L'utilisateur a un cookie auth invalide (expiré, ou chiffré avec un
 *     AUTH_SECRET précédent) → Auth.js log "JWTSessionError: no matching
 *     decryption secret" à CHAQUE requête et ne supprime jamais ce cookie
 *     tout seul. On le purge ici à l'atterrissage sur /login.
 *
 * Cookies Auth.js v5 connus :
 *   - authjs.session-token (dev HTTP)
 *   - __Secure-authjs.session-token (prod HTTPS)
 *   - authjs.csrf-token
 *   - authjs.callback-url
 *
 * On nettoie tout ce qui matche pour repartir d'un état propre.
 */
const AUTHJS_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
];

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/chat");

  // Session est null mais on peut quand même avoir des cookies authjs.*
  // résiduels (corrompus / vieux secret). On les purge.
  const cookieStore = await cookies();
  for (const name of AUTHJS_COOKIE_NAMES) {
    if (cookieStore.has(name)) cookieStore.delete(name);
  }

  return <LoginForm />;
}
