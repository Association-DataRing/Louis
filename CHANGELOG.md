# Changelog

Toutes les évolutions notables sont documentées ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Versionnement : [SemVer](https://semver.org/lang/fr/).

## [Non publié] — Pré-launch publique

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
