# Tests E2E

Smoke tests Playwright. Vérifient que l'app démarre, que l'auth fonctionne,
que toutes les routes principales rendent leur titre, et que le chat / la
command palette répondent.

## Prérequis

```bash
ADMIN_EMAIL=admin@louis.local ADMIN_PASSWORD=password npm run db:seed
npx playwright install --with-deps chromium
```

## Lancement

```bash
npm run dev                  # dans un terminal
npm run test:e2e             # dans un autre
npm run test:e2e:ui          # mode UI Playwright
```

## Variables d'environnement

| Var            | Défaut                  |
|----------------|-------------------------|
| E2E_BASE_URL   | http://localhost:3000   |
| E2E_EMAIL      | admin@louis.local       |
| E2E_PASSWORD   | password                |

## Hors-scope

- Pas d'assertion sur les réponses LLM (coût, non-déterminisme). On vérifie
  que le composer accepte la saisie, pas que Louis répond correctement.
- Pas de test des connecteurs externes (PISTE, Pappers) — ils dépendent
  d'identifiants tiers et de la connectivité réseau.
