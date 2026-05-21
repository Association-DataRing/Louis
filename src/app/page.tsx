import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Racine de l'app Louis. Pas de landing publique embarquée — la page
 * marketing vit dans un repo séparé (louis.data-ring.net). Ici on
 * redirige immédiatement : `/dashboard` si l'utilisateur est connecté,
 * `/login` sinon.
 */
export default async function RootPage() {
  const session = await auth();
  redirect(session?.user ? "/dashboard" : "/login");
}
