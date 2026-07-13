"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale, type Locale } from "./config";

/**
 * Persiste la locale choisie dans le cookie `LOUIS_LOCALE`.
 *
 * Le rafraîchissement de l'UI est laissé au client (`router.refresh()`) :
 * les Server Components relisent le cookie à la requête suivante via
 * `src/i18n/request.ts`. Cookie d'un an, `lax` (suffisant, pas de besoin
 * cross-site), non `httpOnly` car purement préférentiel.
 */
export async function setLocaleAction(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
