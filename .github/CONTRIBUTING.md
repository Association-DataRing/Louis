# Contribuer à Louis

Merci de votre intérêt pour Louis. Ce projet est en alpha — l'ouverture
formelle aux contributions externes interviendra autour de la v0.2, le
temps que les fondations se stabilisent.

D'ici là, vous pouvez nous aider de plusieurs manières.

## Comment aider dès aujourd'hui

### 1. Tester l'alpha et remonter ce qui casse

Suivez le `README.md` pour déployer Louis en local. Ouvrez une issue dès que
quelque chose ne fonctionne pas comme attendu. Précisez :

- votre système (macOS / Linux / Windows + version)
- la version de Node (`node -v`)
- les étapes exactes pour reproduire
- le comportement attendu vs. observé
- les logs pertinents

### 2. Proposer un cas d'usage

Vous êtes avocat, juriste d'entreprise, paralégal, ou DSI de cabinet ? Vos
besoins concrets nous intéressent. Ouvrez une discussion (ou une issue avec
le label `discussion`) pour partager :

- ce que vous aimeriez faire avec Louis
- ce que vous faites aujourd'hui sans Louis
- les obstacles à l'adoption dans votre structure

### 3. Suggérer un connecteur juridique

Si une source juridique française (institutionnelle ou commerciale) manque
au catalogue, ouvrez une issue avec le label `connector`. Précisez :

- le nom de l'API
- son URL de documentation
- le modèle d'accès (clé API, OAuth, IP allowlist…)
- votre cas d'usage métier

### 4. Améliorer la documentation

Le `README` et ce fichier peuvent toujours être plus clairs. Une PR de
correction orthographique ou de précision est bienvenue, même en alpha.

## Quand les contributions code seront ouvertes (v0.2+)

Les règles ci-dessous décrivent ce qui sera attendu une fois le projet
ouvert. Inutile de les suivre tant que l'invitation officielle n'a pas
été lancée.

### Avant d'ouvrir une PR

1. Ouvrez d'abord une issue qui décrit le besoin et l'approche envisagée.
2. Attendez un retour favorable avant de commencer à coder.
3. Forkez le repo, créez une branche depuis `main`.

### Standards de code

- TypeScript strict, pas de `any` sans justification commentée.
- ESLint doit passer (`npm run lint`).
- Le build doit passer (`npm run build`).
- Pas de migration Drizzle dans une PR fonctionnelle : les migrations sont
  validées séparément.

### Lockfile

Si vous modifiez les dépendances, **toujours** régénérer le lockfile avec
les variantes cross-platform pour ne pas casser la CI Linux :

```bash
rm -rf node_modules package-lock.json
npm install --include=optional
```

Sinon `npm ci` échoue côté Linux avec
`EUSAGE Missing: @emnapi/runtime@x.y.z` (deps optionnelles platform-specific
référencées par Vitest / Rolldown mais non matérialisées dans le lockfile).

### Messages de commit

Convention : `<type>(<scope>): <description>` en minuscules.

- `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `ci`
- scope optionnel : `chat`, `providers`, `connectors`, `auth`, etc.

Exemples :
```
feat(providers): support OVH AI Endpoints
fix(chat): preserve markdown blocks on partial streams
```

### Pull request

- Titre = même format que les commits.
- Description : pourquoi, quoi, comment vérifier.
- Cochez les cases du template de PR avant de demander la revue.

## Licence

Toute contribution est acceptée sous la licence du projet, **AGPL-3.0-or-later**.
En ouvrant une PR vous confirmez avoir le droit de soumettre ce code et
acceptez sa redistribution sous AGPL-3.0.

## Code de conduite

Soyez professionnels et respectueux. Les attaques personnelles, le
harcèlement et la discrimination ne sont pas tolérés. Les conflits se
règlent par discussion publique, calme et factuelle.
