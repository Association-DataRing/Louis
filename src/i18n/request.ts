import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import frMessages from "../../messages/fr";
import enMessages from "../../messages/en";
import { LOCALE_COOKIE, defaultLocale, isLocale, type Locale } from "./config";

/**
 * Catalogues chargés statiquement depuis les barrels par locale
 * (`messages/<locale>/index.ts`). Import statique plutôt que dynamique :
 * Turbopack/standalone résolvent ainsi sans ambiguïté, et le surcoût de
 * bundler les deux langues (du texte) est négligeable.
 */
const catalogs: Record<Locale, typeof frMessages> = {
  fr: frMessages,
  en: enMessages,
};

/**
 * Résout la locale et fournit les messages à chaque requête.
 *
 * La locale provient du cookie `LOUIS_LOCALE` ; en son absence (ou si la
 * valeur est invalide) on retombe sur `fr`. Aucune négociation
 * `Accept-Language` : le choix est explicite et persistant côté utilisateur
 * via le sélecteur de langue.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieValue = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieValue) ? cookieValue : defaultLocale;

  return {
    locale,
    messages: catalogs[locale],
  };
});
