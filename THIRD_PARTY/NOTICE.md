# Third-Party Notices

Ce fichier liste les projets et ressources tierces qui ont influencé Louis,
ainsi que leurs licences respectives.

## Inspirations UX et conceptuelles

### Mike — OSS AI Legal Platform

- **Repo** : https://github.com/willchen96/mike
- **Licence** : AGPL-3.0
- **Usage** : Louis s'inspire de **l'approche UX** de Mike (chat sur documents
  juridiques, organisation par projets, flux d'upload) mais réécrit son code
  intégralement sur une stack Next.js 16 + Server Components. Aucun code source
  de Mike n'est repris verbatim dans Louis.
- **Remerciements** : merci à l'auteur de Mike d'avoir prouvé qu'une plateforme
  IA juridique open-source était viable et désirable.

## Dépendances majeures

La liste complète des dépendances et de leurs licences est disponible dans le
fichier `package.json` du projet et peut être inspectée via :

```bash
npx license-checker --production --summary
```

Quelques dépendances notables :

| Projet                                                   | Licence       | Usage              |
| -------------------------------------------------------- | ------------- | ------------------ |
| [Next.js](https://github.com/vercel/next.js)             | MIT           | Framework          |
| [React](https://github.com/facebook/react)               | MIT           | UI runtime         |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | MIT        | Styles             |
| [shadcn/ui](https://github.com/shadcn-ui/ui)             | MIT           | Composants UI      |
| [Tabler Icons](https://github.com/tabler/tabler-icons)   | MIT           | Icônes             |
| [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) | Apache-2.0  | ORM (prévu)        |
| [Vercel AI SDK](https://github.com/vercel/ai)            | Apache-2.0    | Streaming IA (prévu) |

## Polices

- **Geist Sans / Geist Mono** (Vercel) — SIL Open Font License 1.1
- **EB Garamond** (Georg Mayr-Duffner, sur dessins de Claude Garamont) —
  SIL Open Font License 1.1

## Données et référentiels juridiques

Louis se connecte (via BYOK utilisateur) à des sources externes. Le traitement
de leurs données est régi par les conditions d'utilisation de chaque
fournisseur. Louis ne redistribue **aucune donnée juridique** dans son code
source.

- Légifrance / PISTE — © DILA, Licence Ouverte 2.0
- Judilibre — © Cour de cassation, Licence Ouverte 2.0
- JADE — © Conseil d'État, Licence Ouverte 2.0
- BODACC — © DILA, Licence Ouverte 2.0
- Pappers — CGU Pappers (compte utilisateur requis)
