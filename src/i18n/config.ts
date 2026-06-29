/**
 * Configuration i18n centrale.
 *
 * Louis utilise next-intl en mode « sans routing par locale » : la langue
 * active est stockée dans un cookie (pas de préfixe d'URL). Cela évite de
 * déplacer toute l'arborescence App Router sous un segment `[locale]` et
 * préserve les route groups existants — `(app)`, `print`, `login`.
 *
 * Souveraineté : next-intl est entièrement local, aucun appel réseau.
 */
export const locales = ["fr", "en"] as const;

export type Locale = (typeof locales)[number];

/** Français par défaut (langue historique du produit). */
export const defaultLocale: Locale = "fr";

/** Nom du cookie portant la locale choisie par l'utilisateur. */
export const LOCALE_COOKIE = "LOUIS_LOCALE";

/** Libellés natifs affichés dans le sélecteur de langue. */
export const localeLabels: Record<Locale, string> = {
  fr: "Français",
  en: "English",
};

/** Garde de type : vrai si la valeur est une locale supportée. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
