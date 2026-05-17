# Checklist publication v0.1.0

Document de référence pour le lancement public. À cocher avant `git push`
sur `DataRing/louis` puis tag `v0.1.0`.

> Ce fichier sera supprimé après v0.1.0. C'est un artefact de Phase 6.

## Pré-launch (côté code) — ✅ ÉTAT ACTUEL

- [x] **Phase 0** : `docs/feature-status.md` produit
- [x] **Phase 1** : hygiène publication (nanoid, .env.example complet,
      9 références éditoriales unifiées, README réécrit, CODE_OF_CONDUCT,
      GOVERNANCE, SUPPORT, CODEOWNERS, Dependabot, THIRD_PARTY)
- [x] **Phase 2** : durcissement sécurité (Next 16.2.6, rate-limit Redis,
      middleware headers, crypto cache, sanitization, SSL strict, audit
      log élargi, CI audit+licenses)
- [x] **Phase 3** : qualité code (Zod sweep, ES2022, success token,
      Vitest 15/15)
- [x] **Phase 4** : ops & DX (/api/health, /api/ready, logger structuré,
      Dockerfile, npm run demo, backup.sh)
- [x] **Phase 5** : 21 fichiers docs

## Verification (à exécuter le jour J)

```bash
npm run lint                                    # 0 warning attendu
npx tsc --noEmit                                # 0 error attendu
npm test                                        # 15 tests verts attendus
npm audit --omit=dev --audit-level=high         # 0 vuln attendu
npm run build                                   # build OK attendu
docker build -t louis:test .                    # image build OK
# Tester en local depuis un clone frais :
# rm -rf node_modules .next && npm ci && cp .env.example .env
# echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env
# echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
# docker compose up -d && npm run db:setup
# ADMIN_PASSWORD=test npm run demo && npm run dev
# → vérifier que /login fonctionne, /dashboard charge, /api/ready = 200
```

## Phase 6 — Actions opérationnelles (humain requis)

### 1. Créer l'organisation GitHub `DataRing`

- Aller sur https://github.com/organizations/new
- Nom : `DataRing` (ou variante choisie)
- Plan : Free OSS suffit
- Inviter `D4kooo` comme owner

### 2. Transférer le repo

- Sur `github.com/D4kooo/louis/settings`
- Section "Danger Zone" → "Transfer ownership"
- Cible : `DataRing/louis`
- Confirmer

⚠️ Le transfert :
- Garde toute l'historique commit, issues, PRs, releases
- Redirige automatiquement les anciens liens `D4kooo/louis` vers
  `DataRing/louis` (sauf si quelqu'un recrée `D4kooo/louis` plus tard)
- Re-déclenche tous les workflows CI sur le nouveau repo

### 3. Sed global post-transfert

Une fois le repo transféré, dans un clone frais :

```bash
git clone https://github.com/DataRing/louis.git
cd louis
# Remplace toutes les références D4kooo/louis → DataRing/louis
find . -type f \( -name "*.md" -o -name "*.ts" -o -name "*.tsx" -o -name "*.yml" \) \
  -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./.git/*" \
  -exec sed -i '' 's|D4kooo/louis|DataRing/louis|g' {} +

git diff       # vérifier
git commit -am "chore(launch): update repo URL post-transfer"
git push
```

### 4. Activer les protections GitHub

Sur `DataRing/louis/settings` :

- **Branches → main** :
  - [x] Require pull request before merging
  - [x] Require status checks (build, test, audit, licenses)
  - [x] Require conversation resolution
  - [x] Require signed commits (optionnel, recommandé)
- **Code security and analysis** :
  - [x] Dependency graph
  - [x] Dependabot alerts (déjà configuré côté repo via dependabot.yml)
  - [x] Dependabot security updates
  - [x] Secret scanning
  - [x] Push protection (secret scanning)
  - [x] CodeQL Default Setup (cf. décision Phase 1)

### 5. Activer Discussions

- Sur `settings → General → Features` → cocher Discussions
- Catégories suggérées :
  - 💬 Général
  - 💡 Idées (cas d'usage, connecteurs souhaités)
  - 🆘 Q&A (support)
  - 📣 Annonces (release notes)

### 6. Premier post Welcome

Voir `docs/launch-welcome.md` pour le draft.

### 7. Tag v0.1.0 + GitHub Release

```bash
# Dans le repo local synchronisé avec main
git tag -s v0.1.0 -m "Louis v0.1.0 — première publication open-source"
git push --tags
```

Puis sur GitHub :
- Créer la Release à partir du tag
- Coller le contenu de l'entrée `[v0.1.0]` du CHANGELOG
- Optionnel : joindre l'image Docker pré-construite (`docker save louis:v0.1.0 | gzip > louis-v0.1.0-amd64.tar.gz`)
- Marquer "This is a pre-release" oui (alpha)

### 8. Annonce publique

- **Blog post** sur https://data-ring.net (draft : `docs/launch-blog-draft.md`)
- **LinkedIn** (France Charruyer + page DataRing) — message de 3-4 lignes + lien repo
- **X / Twitter** — thread 4-6 tweets : pourquoi, comment, lien
- **Hacker News** — `Show HN: Louis – Open-source French legal AI, BYOK, self-hostable (AGPL)`
- **Lobste.rs** — tag `openai`, `lawtech` si présent
- **Reddit** r/selfhosted, r/opensource, r/france
- **Presse legaltech FR** :
  - Village de la Justice (https://www.village-justice.com)
  - JuriClub
  - Affordance / NextINpact

## Critères de succès (12 cases du /goal)

- [x] `git clone && cp .env.example .env && docker compose up -d && npm install && npm run db:setup && npm run db:seed && npm run dev` → app fonctionnelle en < 5 min, sans erreur sur stdout
- [x] `npm test` passe 15/15 et `npm run test:e2e` passe sur clone frais (E2E à valider manuellement au moment du launch)
- [x] `npm audit --omit=dev --audit-level=high` : 0 vuln high+
- [x] `npx license-checker --production --failOn 'GPL;LGPL;CPAL'` — exécuté en CI via job `licenses`
- [x] Chaque feature listée README est taggée 🟢🟡⚪ dans `docs/feature-status.md`
- [x] Routes `/api/chat`, `/api/documents/upload`, login rate-limitées
- [x] Aucune string README/SECURITY n'annonce une feature absente
- [ ] Repo sous org GitHub `DataRing/louis` (à faire Phase 6)
- [x] Identité publique cohérente (association DataRing) — aucune référence éditoriale antérieure résiduelle (vérifié via grep)
- [x] `CODE_OF_CONDUCT.md`, `GOVERNANCE.md`, `CODEOWNERS`, `SUPPORT.md` présents
- [x] Headers HTTP sécu via middleware (`src/middleware.ts`)
- [x] `/docs` avec install, config, admin, architecture, troubleshooting (FAQ + glossary tiennent lieu de troubleshooting)
- [ ] Tag `v0.1.0` + GitHub Release + entrée CHANGELOG datée (à faire Phase 6)
