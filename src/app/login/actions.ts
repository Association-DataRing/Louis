"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

export type LoginState = {
  error?: string;
};

/**
 * Extrait l'IP cliente depuis les headers de proxy. Priorité :
 *  - `x-forwarded-for` (premier segment)
 *  - `x-real-ip`
 *  - fallback "unknown" (ne déclenchera qu'un seul compteur partagé, ce qui
 *    est conservateur en cas de proxy mal configuré).
 */
async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = h.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const totp = formData.get("totp");

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Champs requis manquants." };
  }

  // Rate-limit anti brute-force par IP. La fenêtre est globale (toute
  // tentative compte, même valides) — un attaquant qui spamme avec un
  // bon mot de passe pour 1 user verrouille AUSSI les vraies tentatives,
  // mais c'est OK : le verrouillage temporaire est exactement ce qu'on veut.
  const ip = await getClientIp();
  const rl = await rateLimit("login", ip);
  if (!rl.allowed) {
    const retryS = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return {
      error: `Trop de tentatives. Réessayez dans ${retryS} secondes.`,
    };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      totp: typeof totp === "string" ? totp : "",
      redirectTo: "/dashboard",
    });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Identifiants invalides." };
    }
    // Next.js redirect throws are expected — re-throw.
    throw err;
  }
}
