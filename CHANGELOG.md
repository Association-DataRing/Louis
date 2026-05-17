# Changelog

Toutes les évolutions notables sont documentées ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Versionnement : [SemVer](https://semver.org/lang/fr/).

## [Non publié] — Pré-launch publique

### Sprint « publication open-source DataRing » — 2026-05-16

**Phase 0 — Audit de réalité features**
- Production de `docs/feature-status.md` : tableau complet 🟢🟡🔴 des
  fonctionnalités annoncées vs. effectivement implémentées
- Identification de 4 zones rouges : sub-APIs PISTE étendues, rate-limit
  Redis, audit log élargi, headers HTTP sécu

**Landing publique — refonte SaaS classique avec vidéo Remotion**
- Refonte complète de `src/app/page.tsx` selon un pattern SaaS classique
  généré via AIDesigner (run d7b753f3) puis porté avec les tokens du repo :
  Nav fixe + hero centré titre serif géant + vidéo qui peek du bas +
  citation Ulpien + section architecture asymétrique 7/5 (carte BYOK +
  terminal .env mock) + souveraineté providers FR/UE/US/auto-hébergés +
  manifeste 5-cards section dark + footer institutionnel
- `remotion/` : composition `LouisDemo` (12s, 1920×1080, 30fps) — intro
  logo + chat avec typewriter sur question avocat + tool call pill
  `legifrance_search` + réponse AI streamée + DocPanel slide-in avec
  highlight cible sur l'article 1245 du Code civil. Loop seamless via
  loopOpacity au boundary.
- Render output : `public/hero-demo.mp4` (885 kB, h264 CRF 23) +
  `public/hero-poster.jpg` (49 kB, frame 180) intégrés dans la hero
  via `<video autoPlay muted loop playsInline preload="metadata">`.
- npm scripts `video:preview` / `video:render` / `video:poster` ajoutés.
- Polices Remotion via `@remotion/google-fonts` (EB Garamond + Geist)
  pour cohérence avec l'identité de la landing.

**Phase 5 — Documentation**
- Création de `docs/` (21 fichiers) :
  - `docs/README.md` : index
  - `docs/installation/` : `docker-compose.md`, `bare-metal.md`
  - `docs/configuration/` : `env-vars.md` (référence exhaustive),
    `providers.md`, `connectors.md`
  - `docs/admin/` : `users.md`, `audit-log.md`, `backups.md`
  - `docs/architecture/` : `overview.md` (diagramme + flux), `data-model.md`
  - `docs/architecture/decisions/` : 4 ADRs (BYOK, AGPL, pgvector,
    MCP-native)
  - `docs/security/` : `threat-model.md` (10 vecteurs), `secret-rotation.md`
  - `docs/user/` : `chat.md`, `documents.md`
  - `docs/feature-status.md` (déjà créé Phase 0)
  - `docs/faq.md`, `docs/glossary.md`

**Phase 4 — Opérationnel & DX**
- Endpoints `/api/health` (liveness simple) et `/api/ready` (readiness avec
  ping DB Postgres + Redis, retourne 503 si une dépendance est down)
- `src/lib/log.ts` : logger minimaliste sans dépendance (~30 lignes)
  qui émet du JSON en prod et du texte humain en dev. Migration des
  `console.warn` de `audit.ts` et `rate-limit.ts`
- `Dockerfile` multi-stage prod (node:24-alpine, output standalone, user
  non-root nextjs, HEALTHCHECK interne) + `.dockerignore`
- `scripts/seed-demo.ts` + `npm run demo` : seed admin + 5 workflows
  juridiques + 1 projet "Affaire pilote" + 3 dossiers documents
  (Contrats / Jurisprudences / Mémos internes). Idempotent.
- `scripts/backup.sh` : pg_dump + chiffrement GPG AES-256 avec passphrase
  séparée d'`ENCRYPTION_KEY` (rotation-friendly)

**Phase 3 — Qualité code**
- Sweep complet des `z.string().uuid()` → `z.uuid()` et `z.string().trim().url()`
  → `z.url()` (5 fichiers, 7 occurrences)
- TypeScript target ES2017 → ES2022 (bundle plus léger, features natives Node 24)
- Token CSS `--success` / `--color-success` ajouté (light: oklch(0.55 0.13 160),
  dark: oklch(0.7 0.14 160)), remplace 6 occurrences de `bg-emerald-*` /
  `text-emerald-*` hardcodées
- Setup Vitest + 15 tests unitaires sur `src/lib/crypto.ts` (round-trip,
  tampering detection, missing key) et `src/lib/rate-limit.ts` (mock Redis,
  buckets, headers IETF)
- Nouveau job CI `Unit tests (Vitest)` + scripts `npm test`, `npm run test:watch`,
  `npm run test:coverage`
- Fix dernier warning ESLint dans `chat-shell.tsx` (`setOpenDoc` wrappé en
  `useCallback` pour stabilité de référence)

**Phase 2 — Durcissement sécurité**
- **Bump Next.js 16.2.3 → 16.2.6** : 3 vulnérabilités high (middleware/proxy
  bypass via dynamic route params, segment-prefetch routes, i18n Pages
  Router) + 1 high (cache poisoning RSC) corrigées
- **Rate-limit Redis** (`src/lib/rate-limit.ts`) sur 3 buckets :
  `chat` (30/min/user), `upload` (60/h/user), `login` (10/15min/IP).
  Fenêtre fixe via INCR+EXPIRE, fail-open si Redis indisponible. Headers
  `RateLimit-*` standardisés (draft IETF) sur les 429
- **Middleware HTTP** (`src/middleware.ts`) avec headers sécu : CSP,
  X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy strict,
  Permissions-Policy minimal, HSTS en prod
- **Crypto** (`src/lib/crypto.ts`) : cache `scryptSync` au module-load
  (évite 10-100ms par encrypt/decrypt sur chaque appel chat)
- **Sanitization filename** dans `/api/documents/upload` (S3 key) et
  `/api/documents/[id]/file` (Content-Disposition) — protection contre
  les injections CRLF/quote/backslash en header HTTP
- **SSL Postgres strict** : `DATABASE_SSL_REJECT_UNAUTHORIZED=true` par
  défaut, configurable
- **Audit log élargi** : `recordAudit` wiré sur provider.add/delete/toggle,
  connector.add/delete, doc.delete, cabinet.update, auth.login,
  auth.login.failed (avec raison : unknown / inactive / bad_password)
- **CI sécurité** : nouveaux jobs `audit` (`npm audit --omit=dev
  --audit-level=high`) et `licenses` (allowlist explicite compatible
  AGPL via license-checker)
- **SECURITY.md** complètement réécrite : modèle de sécurité explicite,
  mesures de défense en place, bonnes pratiques admin

**Phase 1 — Hygiène publication**
- `package.json` : ajout dépendance `nanoid` explicite (était transitive,
  risque de break sur clean install)
- `.env.example` : ajout `GOTENBERG_URL`, `DATABASE_SSL_*`, futurs
  `RATE_LIMIT_*`
- Réécriture complète du README en cohérence avec `docs/feature-status.md`
  (déclassement Judilibre/JADE/INPI/BODACC → planifié v0.1.x, mention
  honnête des zones partielles et planifiées)
- Identité publique unifiée : **association DataRing** porteur unique du
  projet — 9 références éditoriales antérieures remplacées (footer,
  métadonnées, placeholders cabinet, README, SECURITY)
- Ajout `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1 FR)
- Ajout `GOVERNANCE.md` (processus de décision solo-mainteneur,
  signature DCO, évolution prévue)
- Ajout `SUPPORT.md` (où poser une question / signaler un bug / une
  vulnérabilité)
- Ajout `CODEOWNERS` (D4kooo seul, alpha solo-mainteneur)
- Ajout `.github/dependabot.yml` (npm hebdo groupé par stack, GHA mensuel,
  Docker mensuel)
- `THIRD_PARTY/NOTICE.md` : retrait d'Inter (plus utilisée), ajout
  EB Garamond
- `SECURITY.md` : adresse `security@data-ring.net`

### Ajouté — Sprint « launch vs Mike OSS »

**Killer feature : suivi de coûts**
- Catalogue des tarifs publics par modèle (`src/lib/providers/pricing.ts`)
  avec séparation EUR / USD (pas de conversion automatique)
- Page `/usage` : coût mensuel, tokens entrée / sortie, messages, détail
  par modèle trié par coût desc, total all-time
- Pill « coût estimé » dans le header du chat, à côté des tokens
- Modèles auto-hébergés (Albert, openai-compatible) à 0 — vous payez
  l'infra ailleurs

**Polish / complétude**
- Recherche globale **Cmd+K** : palette de commandes cmdk avec
  Conversations / Projets / Documents / Workflows / Navigation /
  Administration (admin-only)
- **Épingler les conversations** : tri pinned d'abord dans la sidebar,
  icône Pin filled dédiée
- **Export Markdown** d'une conversation (téléchargement Blob côté
  client)
- **Export PDF** via impression navigateur (`/print/chat/[id]` hors
  layout app, prose A4 imprimable, auto-`window.print()`)
- **Versioning des documents** : colonnes `parent_document_id` +
  `version`, item « Uploader nouvelle version » sur chaque ligne, vue
  groupée par famille avec historique repliable
- **Hiérarchie de dossiers** : table `document_folders` self-référencée,
  page `/documents?folder=<id>` avec breadcrumb, sous-menu « Déplacer
  vers (dossier) »

**Robustesse / qualité**
- Enveloppe **`ToolResult` uniforme** pour tous les outils IA (PISTE,
  Pappers, search_documents) — fini les `throw` opaques, le modèle
  reçoit `{ ok, reason, error }` et relaie un message actionnable :
  clé manquante, OAuth expiré, rate limit 429, timeout, 5xx, etc.
  Cache token PISTE invalidé sur 401 pour profiter d'un renouvellement
  silencieux
- **Tabular reviews async** : `runTabularReview` marque les lignes en
  « running » et schedule le traitement via `next/server::after()` —
  fenêtre coulissante de 3 workers concurrents, `<AutoRefresh>` côté
  client poll `router.refresh()` toutes les 2.5s tant qu'il y a du
  travail en vol. Un review de 50 docs ne timeout plus
- **Smoke tests E2E Playwright** : 11 routes principales × titre,
  Cmd+K, composer chat, login / mauvais mdp. Scripts `npm run test:e2e`
  et `test:e2e:ui`

## [Non publié] — Fondations

### Ajouté

**Fondations**
- Bootstrap Next.js 16 + React 19 + Tailwind v4 + shadcn/ui (preset radix-nova)
- React Compiler activé via babel-plugin-react-compiler
- Authentification NextAuth v5 (Credentials, sessions JWT, bcrypt)
- Chiffrement AES-256-GCM (`src/lib/crypto.ts`) avec dérivation scrypt
  depuis `ENCRYPTION_KEY` — utilisé pour toutes les clés tierces stockées
- Schéma Drizzle : `users`, `provider_keys`, `conversations`, `messages`,
  `connector_keys`, `documents`
- Docker Compose : Postgres 16 + pgvector, Redis 7, MinIO

**Landing publique**
- Page d'accueil avec sections Manifeste, Comment ça marche (4 étapes),
  Pour qui (cabinets / directions juridiques / juristes indépendants), CTA
- Header sticky, favicon SVG bleu de France, métadonnées Open Graph + Twitter
- Citation d'Ulpien et référence à Saint Louis sous le chêne de Vincennes

**Providers IA BYOK (`/providers`)**
- Catalogue de 7 providers : Mistral, Scaleway, OVH, Albert (Etalab),
  Anthropic, OpenAI, endpoint OpenAI-compatible (Ollama, vLLM, etc.)
- Badges de souveraineté FR / UE / US sur chaque clé
- Test de connexion via `/models` (Bearer ou x-api-key selon provider)
- Toggle actif + défaut par type
- Dialog d'ajout avec groupe Souverains / US dans le select

**Connecteurs juridiques BYOK (`/connectors`)**
- Catalogue : PISTE (passerelle Légifrance / Judilibre / JADE / INPI /
  BODACC) et Pappers
- Credentials JSON chiffrées en blob, champs dynamiques selon le type
- Badges "Débloque : …" pour pédagogie

**Chat streaming (`/chat`)**
- Sidebar des 30 dernières conversations, "Nouvelle conversation"
- Sélecteur de provider avec badge souveraineté visible
- Rendu markdown des réponses (react-markdown + GFM + tailwindcss/typography)
- Persistance auto (conversationId via messageMetadata du stream)
- System prompt FR anti-hallucination
- Joindre des documents au prompt via popover + chips
- **Tool calling** : Pappers (search + get) et Légifrance via PISTE
  (OAuth2 client_credentials + cache de token in-memory)
- UI tool parts compacts avec spinner / icône / résumé d'input
- **DocPanel side-by-side** : preview PDF natif via react-pdf,
  citations cliquables avec quote highlighting
- **Workflows** : bibliothèque de prompts cabinet + picker dans le composer
- **Projets** : conteneurs dossier client, move-to-project depuis
  Conversation et Document
- **Mentions de documents** dans les réponses cliquables (restent
  cliquables après reload)
- Mobile drawer hamburger

**Documents (`/documents`)**
- Upload PDF / DOCX / texte jusqu'à 25 Mo
- Stockage S3-compatible (MinIO en dev, Scaleway / OVH / AWS en prod)
- Extraction texte serveur : pdf-parse v1 (bundlé, sans worker) + mammoth
- Cap à 500 000 caractères avec badge "tronqué"
- RAG : chunking + embeddings Mistral + recherche vectorielle pgvector
- Liste avec icônes par type, taille formatée, état d'extraction

**Analyses tabulaires (`/tabular-reviews`)**
- Excel-style : sélection de N documents, définition de colonnes prompts,
  extraction structurée via `generateObject` + Zod
- Statut par ligne (pending / running / ok / error) avec relance ciblée

**Multi-utilisateur (`/admin`)**
- RBAC admin / member, page admin/users (create / toggle / role / delete)
- Pages `/profile` (informations + change password)

**Paramètres**
- Affichage email / dernière connexion / date de création
- Changement de nom affiché
- Changement de mot de passe (bcrypt.compare + bcrypt.hash 12 rounds,
  min 10 caractères, validation zod)

**Quincaillerie**
- GitHub Actions : CI lint + build sur push/PR vers main
- CONTRIBUTING.md, SECURITY.md, CHANGELOG.md, .nvmrc (Node 24)
- Issue templates (bug.yml, feature.yml, config.yml) et PR template
- README marketing avec badges, manifeste, roadmap publique
