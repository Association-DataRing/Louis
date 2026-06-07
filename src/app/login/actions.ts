"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn, verifyPasswordStep } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

export type LoginStep = "credentials" | "totp";

export type LoginState = {
  /** Étape que l'UI doit afficher après cette action. */
  step: LoginStep;
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

/**
 * Login en deux temps, piloté par le champ caché `step` :
 *
 *  1. `credentials` — on valide email + mot de passe (sans session). Si le
 *     compte a la 2FA, on renvoie `{ step: "totp" }` pour révéler l'écran de
 *     code. Sinon on finalise directement (signIn → redirect).
 *  2. `totp` — email + mot de passe sont rejoués avec le code ; `signIn`
 *     revalide tout (mot de passe + second facteur) et établit la session.
 *
 * Pour un compte sans 2FA, l'utilisateur ne voit qu'une seule étape : le
 * premier submit le connecte. Le double bcrypt (vérif d'étape 1 puis re-vérif
 * dans `authorize`) est négligeable sur ce chemin froid.
 */
export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const step = formData.get("step") === "totp" ? "totp" : "credentials";
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return { step: "credentials", error: "Champs requis manquants." };
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
      step,
      error: `Trop de tentatives. Réessayez dans ${retryS} secondes.`,
    };
  }

  // --- Étape 1 : vérifier les identifiants, déterminer si la 2FA est requise.
  if (step === "credentials") {
    const res = await verifyPasswordStep(email, password);
    if (res.status === "invalid") {
      return { step: "credentials", error: "Identifiants invalides." };
    }
    if (res.needsTotp) {
      // Mot de passe valide mais 2FA activée → on demande le code. Aucune
      // session n'est établie tant que le second facteur n'est pas fourni.
      return { step: "totp" };
    }
    // Pas de 2FA : on enchaîne sur la finalisation ci-dessous.
  }

  // --- Finalisation : étape 1 sans 2FA, OU étape 2 avec le code.
  const totp = formData.get("totp");
  try {
    await signIn("credentials", {
      email,
      password,
      totp: typeof totp === "string" ? totp : "",
      redirectTo: "/dashboard",
    });
    // Inatteignable : signIn lève un redirect en cas de succès.
    return { step };
  } catch (err) {
    if (err instanceof AuthError) {
      // À l'étape 2, le mot de passe a déjà été validé : un échec ici = code
      // 2FA invalide. On reste sur l'écran de code.
      if (step === "totp") {
        return { step: "totp", error: "Code de vérification invalide." };
      }
      return { step: "credentials", error: "Identifiants invalides." };
    }
    // Next.js redirect throws are expected — re-throw.
    throw err;
  }
}
