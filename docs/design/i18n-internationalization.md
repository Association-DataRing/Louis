# Internationalisation (i18n) — architecture & conventions

> Statut : prototype local (branche `feat/i18n-internationalization`). À présenter
> à @D4kooo avant intégration. Objectif : ouvrir Louis à un usage européen
> (Legal Data Space, cabinets hors France) sans imposer l'anglais — le français
> reste la langue par défaut.

## Choix techniques

- **Librairie : [`next-intl`](https://next-intl.dev)** (v4). Self-contained, zéro
  appel réseau → cohérent avec la souveraineté DataRing.
- **Mode « sans routing par locale » (cookie-based).** La langue active est
  portée par un cookie `LOUIS_LOCALE`, **pas de préfixe d'URL** ni de segment
  `[locale]`. Cela évite de déplacer toute l'arborescence App Router (route
  groups `(app)`, `print`, `login`) et préserve NextAuth / redirections / liens
  existants. Aucun middleware ajouté.
- **Locales : `fr` (défaut) et `en`.** Le français est la source de vérité.
  Aucune négociation `Accept-Language` : le choix est explicite et persistant
  via le sélecteur de langue (Paramètres → Général).

## Arborescence

```
src/i18n/
  config.ts      # locales, defaultLocale, LOCALE_COOKIE, isLocale(), localeLabels
  request.ts     # getRequestConfig — lit le cookie, fournit les messages
  actions.ts     # setLocaleAction(locale) — pose le cookie (server action)
messages/
  fr/
    <namespace>.json   # un fichier par namespace (nav, sidebar, chat, settings…)
    index.ts           # barrel : importe chaque JSON et compose l'objet messages
  en/
    <namespace>.json
    index.ts           # doit rester STRICTEMENT aligné sur fr/index.ts
src/components/language-switcher.tsx   # bascule fr/en (radiogroup, même style que ThemePicker)
```

`request.ts` importe statiquement les deux barrels (`messages/fr`, `messages/en`)
et sélectionne selon le cookie. Import statique (et non dynamique) : Turbopack et
le build `standalone` résolvent sans ambiguïté ; le surcoût de bundler deux
langues de texte est négligeable.

## Conventions de clés

- **Un namespace par zone fonctionnelle** : `nav`, `sidebar`, `mobileNav`,
  `commandPalette`, `chat`, `settings`, `admin`, `documents`, `projects`,
  `board`, `workflows`, `tabularReviews`, `login`, `components`, `common`…
- Clés en **camelCase**. Regrouper en sous-objets quand un namespace est gros
  (`settings.profile.title`, `chat.composer.placeholder`).
- **Interpolation** : `t("greeting", { name })` ↔ `"greeting": "Bonjour {name}"`.
- **Pluriels (ICU)** : `"docs": "{count, plural, =0 {Aucun document} one {# document} other {# documents}}"`.
- `fr` et `en` portent **exactement les mêmes clés**.

## Utilisation dans le code

| Contexte | Import | Récupération |
|----------|--------|--------------|
| Server Component (`async`, pas de `"use client"`) | `import { getTranslations } from "next-intl/server"` | `const t = await getTranslations("nav")` |
| Client Component (`"use client"`) | `import { useTranslations } from "next-intl"` | `const t = useTranslations("nav")` |

Pour une chaîne définie **hors composant** (constante module-level, ex.
`PRIMARY_NAV`), on stocke une `labelKey` et on la résout chez le consommateur
via `t(item.labelKey)` — voir `src/lib/navigation.ts` +
`src/app/(app)/sidebar-content.tsx`.

## Ajouter un namespace

1. Créer `messages/fr/<ns>.json` **et** `messages/en/<ns>.json` (mêmes clés).
2. L'importer dans `messages/fr/index.ts` **et** `messages/en/index.ts` (barrels).
3. Consommer via `getTranslations("<ns>")` / `useTranslations("<ns>")`.

## Périmètre couvert (prototype)

**Couvert (1482 clés, fr ↔ en alignés via `scripts/i18n-check.ts`) :**
- **Toute l'UI `.tsx`** : nav (sidebar, mobile, command-palette), chat, settings
  (tous les sous-onglets), admin, board, documents, projects, tabular-reviews,
  workflows, dashboard, login, pages d'erreur, print, composants partagés.
- **Constantes de données UI affichées** (`.ts`) : catalogue providers
  (descriptions → namespace `providersCatalog`), rôles/modes/personas du board
  (`board.meta`), chips d'outils du chat (`chat.toolMeta`). Pattern : la clé i18n
  stable vit dans la donnée, résolue via `t()` chez le consommateur.

Les chaînes **visibles** sont externalisées : textes, `placeholder`, `title`,
`aria-label`, `alt`, libellés de boutons, états vides, toasts à littéral.

**Non couvert (volontaire) :**
- Messages d'erreur renvoyés par les **server actions** (`*.ts`, affichés en
  toast) — touche au flux serveur ; à faire dans une passe ultérieure via
  `getTranslations` côté action. → *ticket de suivi*.
- **Données de seed** (noms et descriptions des pipelines/personas préchargés)
  — ce sont des données utilisateur, pas de l'UI.
- Prompts système LLM (`systemPrompt`), commentaires, `console.*`, noms de
  marque/modèles, valeurs d'enum techniques, locales de formatage de date
  (`toLocaleDateString("fr-FR")`) — hors i18n d'interface.

## Questions ouvertes pour @D4kooo

1. Confirmer le mode cookie-based (pas de `/en/...` dans l'URL) — OK pour le SEO
   interne (l'app est `noindex`, donc neutre) ?
2. Faut-il une 3ᵉ locale dès maintenant (de/es/it) ou attendre un besoin réel ?
3. Externaliser les messages d'erreur des server actions dans cette PR ou une
   suivante ?
4. Souhaite-t-on un lint CI vérifiant l'alignement des clés fr/en (script
   `scripts/i18n-check.ts`) ?
