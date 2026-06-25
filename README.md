<div align="center">

# Louis

### L'orchestrateur d'IA souverain pour les professions juridiques.
### Pas un chatbot. Un cabinet d'IA.

[![CI](https://github.com/Association-DataRing/Louis/actions/workflows/ci.yml/badge.svg)](https://github.com/Association-DataRing/Louis/actions/workflows/ci.yml)
[![Licence : AGPL-3.0](https://img.shields.io/badge/Licence-AGPL--3.0-000091)](./LICENSE)
[![Status : Alpha](https://img.shields.io/badge/Status-Alpha-orange)](#état-réel-des-fonctionnalités)
[![Made in France](https://img.shields.io/badge/Made_in-France-000091?labelColor=FFFFFF)]()

Application prototype d'intelligence artificielle open-source pour les professions
du Droit. Conçue par l'**Association DataRing** 

**Vos clés. Vos données. Votre infrastructure.**

</div>

---

## Sommaire

1. [Nouveautés récentes](#nouveautés-récentes)
2. [Le problème](#le-problème)
3. [Ce que Louis fait](#ce-que-louis-fait)
4. [Le manifeste](#le-manifeste)
5. [Architecture](#architecture)
6. [Démarrage](#démarrage)
7. [Configuration](#configuration)
8. [État réel des fonctionnalités](#état-réel-des-fonctionnalités)
9. [Stack technique](#stack-technique)
10. [Roadmap](#roadmap)
11. [Sécurité](#sécurité)
12. [Contribuer](#contribuer)
13. [Licence](#licence)

---

## Nouveautés récentes

Fonctionnalités récemment ajoutées au projet : chiffrement des documents à
enveloppe, OCR souverain pluggable, conversion PDF → Markdown canonique et
citations cliquables avec surlignage précis.

### PDF → Markdown canonique

`src/lib/pdf/to-markdown.ts` — conversion locale pdfjs → Markdown structuré.
Les titres sont inférés à partir des tailles de police, les listes et paragraphes
sont préservés. Zéro dépendance externe, souverain, fonctionne hors-ligne.
Remplace `pdf-parse`.

Le chunking RAG (`src/lib/rag/chunk.ts`) est désormais markdown-aware : un titre
Markdown ouvre un nouveau chunk, ce qui améliore la pertinence des résultats RAG
sur les documents structurés.

Le DocPanel propose une bascule « Aperçu PDF / Markdown » (`markdown-doc-view.tsx`).

### OCR pluggable

`src/lib/ocr/` — module OCR avec chaîne de fallback configurable :
Mistral OCR dédié → modèle vision (OpenRouter / Anthropic / OpenAI) → Tesseract
local (`fra`). Jamais bloquant. La page **Settings → OCR** permet de forcer un
moteur ou d'observer l'état du fallback.

### Chiffrement enveloppe DEK complet (ADR 0005 Phase 1 + 2)

Les blobs S3 **et** le texte extrait sont chiffrés à l'upload avec un DEK dédié
par document (XChaCha20), lui-même enveloppé par la master key AES-256-GCM.

- `src/lib/sodium.ts` — wrapper libsodium-sumo
- `src/lib/crypto-envelope.ts` — génération DEK, encrypt/decrypt, wrap/unwrap
- `src/lib/document-crypto.ts` — `decryptDocumentText()`, `fetchDocumentBytes()`,
  `fetchDocumentDecrypted()` (rétrocompatibilité null-DEK)
- Architecture documentée dans `docs/architecture/decisions/0005-client-data-encryption.md`

> Les chunks RAG (`document_chunks`) restent en clair — compromis délibéré
> souveraineté/performance, cf. ADR 0005 §9 option A.

### Embedding configurable

Les embeddings ne sont plus liés à Mistral uniquement. Trois variables `.env`
suffisent pour pointer vers n'importe quel endpoint compatible
(`LOUIS_EMBEDDING_BASE_URL`, `LOUIS_EMBEDDING_MODEL`, `LOUIS_EMBEDDING_API_KEY`).

### Téléchargement de documents

Le bouton « Télécharger » est désormais accessible depuis la page `/documents`
(menu contextuel de chaque ligne), en plus du DocPanel du chat. Le déchiffrement
S3 est transparent — l'utilisateur reçoit le fichier original en clair.

### Réindexation intelligente

`reindexAllDocumentsAction` accepte un paramètre `{ onlyUnindexed: boolean }`
(défaut `true`). Par défaut, seuls les documents sans chunk existant sont traités —
pas de refacturation d'embeddings déjà calculés. L'option `false` force le
recalcul complet (utile après un changement de modèle d'embedding).

Le bouton de réindexation dans l'UI est devenu un dropdown à deux options :
_Indexer les nouveaux documents_ / _Tout réindexer (forcer)_.

### Citations cliquables avec surlignage précis

Les citations insérées par Louis dans ses réponses (liens `louis-doc:`) ouvrent
le DocPanel directement sur la source citée, avec le passage surligné et centré.

- **Normalisation Unicode** — `src/lib/text-highlight.ts` : `findNormalized()`
  réconcilie NFD/NFC pour éviter les faux-négatifs entre le texte extrait par
  pdfjs (souvent NFD) et la citation produite par le LLM (souvent NFC).
- **Aiguille adaptative** — `findNormalizedAdaptive()` tente 120 → 60 → 30 chars
  pour les citations trop longues pour correspondre mot pour mot.
- **Highlight inline** — `<mark class="louis-highlight">` inséré via `splitText`
  (DOM Range) dans le DocPanel Markdown/DOCX, et via le `textRenderer` react-pdf
  dans le DocPanel PDF.
- **Animation pulse** — `@keyframes louis-highlight-pulse` (anneau box-shadow,
  `prefers-reduced-motion` respecté).

### Tests

281 tests Vitest passent (`npx vitest run`). Ajouts :

| Fichier | Cas couverts |
|---|---|
| `src/lib/pdf/to-markdown.test.ts` | H1, H3, liste, paragraphe, document vide |
| `src/lib/extract.test.ts` | format Markdown, `ScannedPdfError`, troncature, type inconnu |
| `src/lib/document-crypto.test.ts` | rétrocompat null-DEK, round-trip Markdown, MAC invalide |
| `src/lib/rag/chunk.test.ts` | frontière titre Markdown, titre + contenu groupés, N titres = N chunks |
| `src/lib/text-highlight.test.ts` | normalisation accents, fallback adaptatif 120→60→30, edge cases |

---

## Le problème

Les outils d'IA juridique grand public posent un dilemme inacceptable
pour la profession du droit : pour bénéficier des modèles les plus capables, il
faut envoyer les pièces de ses clients chez un éditeur de SaaS, le plus
souvent américain, dont les engagements de confidentialité s'arrêtent
là où commencent ses obligations de coopération avec une autorité
étrangère.

L'alternative — renoncer à l'IA — n'est pas tenable. Les délais
compressent, les volumes documentaires explosent, les confrères
équipés vont plus vite.

Le droit est l'art de rendre a chacun le sien, l'outillage du droit doit rester nôtre. L'outil du droit s'est éloigné de l'avocat, du juriste, de l'institution : Hébergé ailleurs calculé ailleurs, régi par d'autres droits. Et a force de "prêt a emploi", la création intellectuelle se délègue par fragments à des machines opérées par d'autres>

Louis est une réponse à cette dépossession : une application web open source conçue pour les professions du droit, auto-hébergeable, agnostique de fournisseur distribuée sous licence GNU AGPL 3.0 or later.

Louis ne vend pas d'IA juridique, n'est pas un produit mais un prototype de solutions libres dans le bac a sable d'intérêt général Data Ring : Un objet de travail collectif mis a disposition pour être éprouvé, critiqué, approprié. 

Le Lab IA de Data Ring est un  bac a sable,  un espace ouvert où l'on essaie, où l'on rate , où l'on recommence où l'on apprend ensemble à habiter techniquement la Technologie. La souveraineté en droit ne se décrète pas elle s'arbitre: Regagner pour créer, pour retrouver la maitrise de ses propres worflows, agents, sa propre forme d'exercice.

C'est un objet de travail mis à l'épreuve : la numérotation v0.1 dit explicitement que le code est en exploration, que l'architecture peut évoluer, que les interfaces ne sont pas stabilisées:
C'est une activité de recherche et de logiciel libre sans conterpartie commerciale ni engagement juridique ou opérationnel. 

Vous orchestrez sous votre contrôle **vos propres** fournisseurs d'IA et **vos propres**
sources juridiques. Aucun appel ne transite par DataRing. Aucune donnée
n'est partagée avec qui que ce soit hors de votre infrastructure. le deployeur de louis est responsable de traitement unique. Vous decidez.


---

## Ce que Louis fait

### Un orchestrateur, pas un chatbot

Louis n'est pas un assistant conversationnel de plus. C'est un
**orchestrateur** : une architecture où plusieurs agents IA — chacun
spécialisé (recherche, rédaction, vérification, citation) — coopèrent
sous le pilotage d'un agent maître pour produire une réponse tracée
de bout en bout.

```
┌─ Orchestrateur ────────────────────────────────────────┐
│  Décide qui fait quoi, synthétise, contrôle            │
└──┬─────────────────────────────────────────────────────┘
   │
   ├─▶ Agent Recherche   (Perplexity, Albert, …)
   ├─▶ Agent Légifrance  (DataRing MCP — verbatim sourcé)
   ├─▶ Agent Rédaction   (Mistral, GPT, Claude…)
   ├─▶ Agent Relecteur   (anti-hallucination · déontologie)
   └─▶ Agent Citateur    (vérifie chaque référence)
```

Chaque agent utilise **votre clé**, sur **le modèle de votre choix**.
La hiérarchie est déclarée dans un fichier de configuration lisible,
versionnable, auditable. Chaque réponse est accompagnée du journal des
agents qui y ont contribué — un véritable « audit trail » opposable.

> **État actuel (v0.2) :** l'orchestrateur fait coopérer de vrais
> agents spécialisés via le **Board** — Maestro (chef d'orchestre),
> Recherche, Légifrance, Rédacteur, Relecteur, Citateur. Quatre presets
> prêts à l'emploi ; un modèle assignable par rôle.

### Chat juridique avec accès aux textes

Posez une question en français à n'importe lequel des grands modèles
(Mistral, Anthropic, OpenAI, Albert/Etalab, Scaleway, OVH, ou un modèle
auto-hébergé via Ollama / vLLM). Louis enchaîne automatiquement les
appels aux outils dont le modèle a besoin : recherche dans Légifrance
via PISTE, recherche de société dans Pappers, recherche sémantique
dans vos propres documents (RAG pgvector).

```
Vous : Que dit la jurisprudence sur la rupture brutale d'une
       relation commerciale établie depuis 8 ans dans le BtoB ?

Louis : [appelle legifrance_search avec query="rupture brutale
        relation commerciale L442-1"]
        [appelle search_documents pour vérifier vos précédents]

        Le régime applicable est l'article L. 442-1, II du Code
        de commerce. La durée du préavis raisonnable s'apprécie
        au regard de l'ancienneté (Cass. com. 6 sept. 2011…
```

### DocPanel : preview fidèle, citations cliquables

Quand Louis cite une jurisprudence ou un article de votre dossier,
le DocPanel s'ouvre sur la droite. Le PDF s'affiche sans toolbar
navigateur. Les DOCX sont rendus en HTML structuré ou en PDF
Gotenberg pour préserver la mise en page Word exacte.

### Génération et édition de documents

Demandez « rédige une mise en demeure pour... » : Louis appelle
`generate_document`, produit un DOCX propre (titres typés, listes,
tableaux, sauts de page), génère un PDF de preview, et le persiste
dans votre stockage S3.

Pour les retouches, Louis utilise `edit_document` avec un format
`::before / ::after / ::reason` rendu côté UI comme une carte
accept/reject.

### Analyses tabulaires

Pour la due diligence, importez N documents et définissez M colonnes
(« Date de signature », « Loi applicable », « Clause de non-concurrence ? »).
Louis remplit la grille N×M en parallèle avec `generateText({ output:
Output.object })` du AI SDK et un schéma Zod par colonne.

### Bibliothèque de workflows

Sauvegardez les prompts récurrents du cabinet (résumé d'arrêt, analyse
de clause, comparaison de contrats, note de synthèse, due diligence
rapide). Cinq workflows par défaut sont importables au premier login.

### Suivi des coûts

Chaque réponse incrémente un compteur de tokens et un coût en €/$
par modèle. La pill du chat affiche en temps réel le coût du mois.
Aucune surprise en fin de période.

---

## Le manifeste : Vous êtes votre seul maître 
Au sens du droit et au sens de le technique


1. **Vos clés, pas les nôtres.** Louis fonctionne en *Bring Your Own
   Key*. Vous branchez vos comptes Mistral, Scaleway, OVH, Anthropic,
   OpenAI, Albert ou un modèle auto-hébergé. Vous choisissez votre fournisseur 
    **Aucun appel IA ne transite par DataRing.**

3. **Vos connecteurs sous vos accés, pas les nôtres.** PISTE (Légifrance), Pappers —
   vous configurez vos accès, vos quotas, vos contrats. Louis
   orchestre, n'intermédie pas.

4. **Vos données, chez vous sur votre infra .** PostgreSQL local, pgvector local,
   fichiers chiffrés sur **votre** stockage (S3 compatible : MinIO,
   Scaleway, OVH, AWS). Docker Compose en une commande.

5. **Open-source AGPL-3.0.** Code lisible, modifiable, auditable.
   Toute amélioration apportée à une instance publique de Louis
   doit revenir à la communauté. Il n'y aura jamais de version
   « premium » cachée du moteur.

6. **Souverain par défaut.** Les fournisseurs européens sont en
   première ligne dans l'interface ; les fournisseurs américains
   restent disponibles mais explicitement étiquetés. Vous choisissez
   où va chaque requête.
   Le choix vous appartient selon votre approche par les risques et envionnement de travail

7. **Autonomie creative.** Vous experimentez, vous etes acteur ou auteurs de vos propres outils 
   selon differents niveaux d'autonomie, soit:
   A. llm externe sous votre propre cle, pour des usages non couverts par le secret professionel,
   ou pour lequel un accord de sous traitance RGPD DPA est conclu et documenté, vous maitrisez vos prompts et vos workflows mais pas le modele
   B. llm souverain en API, vos clé, vos données transitent par un prestataire UE sous DPA. le Risque d'extraterritorialité (Cloud Act FISA 702) est minimisé sans etre nul, il depends de la chaine capitalistique et infrastructurelle du prestataire a examiner au cas par cas. Vous orchestrez sur un socle juridiquement europeen.
   C. llm hebergé en open weight: vous executez un modele (qwen, llamma, etc...) sur votre propre infrastructure, aucune donnee ne quitte votre perimetre. Vous devenez auteur de vos propres outils.

   Louis permet de tester et de combiner ces 3 voies par usage.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Navigateur                                          │
│  └─ Next.js 16 — App Router · Server Components       │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│  Louis (votre serveur)                               │
│  ├─ PostgreSQL + pgvector   RAG, sessions, audit log │
│  ├─ Redis                   cache, rate-limit         │
│  ├─ Object storage          vos documents (chiffrés)  │
│  ├─ Gotenberg               DOCX → PDF fidèle         │
│  └─ MCP gateway             connecteurs juridiques    │
└──────────────────────────────────────────────────────┘
        │                              │
        ▼                              ▼
┌─────────────────────┐       ┌─────────────────────────┐
│ Fournisseurs IA     │       │ Connecteurs juridiques  │
│ (vos clés)          │       │ (vos accès)             │
│                     │       │                         │
│ Mistral · Albert    │       │ PISTE · Légifrance      │
│ Scaleway · OVH      │       │ Pappers                 │
│ Anthropic · OpenAI  │       │ + serveurs MCP custom   │
└─────────────────────┘       └─────────────────────────┘
```

Pour le détail des flux et le modèle de données, voir
[`docs/architecture/overview.md`](./docs/architecture/overview.md)
et [`docs/architecture/data-model.md`](./docs/architecture/data-model.md).

---

## Démarrage

### Prérequis

| Composant | Version minimale | Vérification |
|---|---|---|
| Node.js | 24 LTS | `node -v` |
| Docker | 24 + Compose v2 | `docker compose version` |
| Disque libre | ~5 Go (images Docker + pgvector + dépendances) | `df -h .` |
| Embeddings (RAG) | une clé **Mistral** _ou_ un endpoint d'embedding **auto-hébergé** (Ollama / vLLM / llama.cpp / TEI) | [console.mistral.ai](https://console.mistral.ai) |

> Pour les autres modèles (Anthropic, OpenAI, Scaleway, OVH, Albert),
> les clés sont **optionnelles** et configurables une fois Louis lancé.

### Installation en une commande (recommandée)

**macOS / Linux :**

```bash
curl -fsSL https://raw.githubusercontent.com/Association-DataRing/Louis/main/scripts/install.sh | bash
```

**Windows (PowerShell) :**

```powershell
irm https://raw.githubusercontent.com/Association-DataRing/Louis/main/scripts/install.ps1 | iex
```

Images pré-buildées (GHCR), secrets générés automatiquement, schéma appliqué
au démarrage — puis l'**assistant de premier lancement** (`/setup`) guide la
création du compte admin et la première clé IA dans le navigateur. Détails et
mise à jour : [docs/installation/one-command.md](./docs/installation/one-command.md).

> Aucun prérequis à installer soi-même : le script installe [Docker](https://docs.docker.com/get-docker/)
> s'il manque (Docker Desktop sur macOS/Windows, Docker Engine sur Linux).
> Sur Windows neuf, WSL2 peut exiger un redémarrage — relancez alors la commande.
> Node.js n'est nécessaire que pour l'installation depuis les sources ci-dessous.

### Installation depuis les sources (développement)

**1. Cloner et préparer les secrets**

```bash
git clone https://github.com/Association-DataRing/Louis.git
cd louis
cp .env.example .env

# Deux secrets cryptographiques sont obligatoires.
# Générés une fois, jamais partagés, jamais committés.
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
```

> ⚠️ La rotation de `ENCRYPTION_KEY` invalide toutes les clés provider
> stockées. À choisir une bonne fois, et à versionner dans votre
> gestionnaire de secrets (Vault, AWS Secrets Manager, Scaleway KMS).

**2. Lancer l'infrastructure locale**

```bash
docker compose up -d
```

Quatre conteneurs démarrent :

| Service | Rôle | Port hôte |
|---|---|---|
| `louis-postgres` | PostgreSQL 16 + extension pgvector | 5433 |
| `louis-redis` | Cache, rate-limit | 6379 |
| `louis-minio` | Stockage objet S3-compatible (dev) | 9000 / 9001 |
| `louis-gotenberg` | LibreOffice headless pour DOCX → PDF | 3001 |

**3. Installer les dépendances applicatives**

```bash
npm install
```

> Si vous modifiez `package.json` plus tard, régénérez le lockfile
> avec `npm install --include=optional` pour ne pas casser la CI
> Linux (cf. [`CONTRIBUTING.md`](./.github/CONTRIBUTING.md)).

**4. Initialiser le schéma de base et créer un admin**

```bash
npm run db:setup

# Génère un mot de passe admin fort (≥ 12 caractères).
# Le seed refuse les passwords triviaux.
ADMIN_PW="$(openssl rand -base64 16)"
echo "Admin password : $ADMIN_PW"

ADMIN_EMAIL=admin@louis.local \
  ADMIN_PASSWORD="$ADMIN_PW" \
  npm run db:seed
```

**5. Démarrer Louis**

```bash
npm run dev          # mode développement (http://localhost:3000)
# ou
npm run build && npm start   # mode production
```

Connectez-vous avec `admin@louis.local` et le mot de passe affiché à
l'étape 4.

### Vérification rapide

| Test | Commande | Attendu |
|---|---|---|
| Liveness | `curl http://localhost:3000/api/health` | `{"status":"ok",...}` |
| Readiness | `curl http://localhost:3000/api/ready` | `{"status":"ready",...}` (503 si Postgres ou Redis down) |
| Login | naviguer sur `/login`, taper les credentials | redirection `/dashboard` |
| Palette globale | dans l'app, presser `⌘K` (macOS) ou `Ctrl+K` | ouverture de la palette de navigation |

### Démarrage avec démo pré-remplie

Pour une instance avec workflows importés + projet exemple + arborescence
documents :

```bash
ADMIN_PASSWORD="$(openssl rand -base64 16)" npm run demo
```

---

## Configuration

### Providers IA

Une fois connecté, allez sur **Settings → Providers** pour ajouter vos
clés API. Chaque clé est chiffrée AES-256-GCM (IV de 12 octets aléatoire
par chiffré, tag d'authentification 16 octets, clé dérivée
de `ENCRYPTION_KEY` via scrypt).

Sept types de providers sont supportés :

| Provider | Souveraineté | Embeddings | Note |
|---|---|---|---|
| **Mistral** | 🇫🇷 FR | ✅ | Recommandé. Le seul à fournir aussi les embeddings du RAG en v0.1. |
| **Scaleway** | 🇫🇷 FR | — | OpenAI-compatible. |
| **OVHcloud** | 🇫🇷 FR | — | Endpoints AI par modèle. |
| **Albert** (Etalab) | 🇫🇷 FR | — | Modèles souverains de l'État français. |
| **Anthropic** | 🇺🇸 US | — | Claude. SDK natif. |
| **OpenAI** | 🇺🇸 US | — | GPT. SDK natif. |
| **OpenAI-compatible** | varie | varie | Ollama, vLLM, llama.cpp, ou tout endpoint compatible. |

Badge FR / UE / US affiché partout dans l'interface : sidebar, header,
sélecteur de modèle.

### Connecteurs juridiques

**Settings → Connecteurs** permet de brancher PISTE (api.gouv.fr) et
Pappers. Vous configurez vos propres `client_id` / `client_secret`
PISTE et votre clé Pappers ; Louis se charge de la rotation des tokens
OAuth et de l'invalidation au 401.

### MCP custom

Louis est **MCP-native**. Vous pouvez connecter vos propres serveurs
Model Context Protocol par utilisateur via **Settings → MCP**. Les
tools exposés deviennent disponibles automatiquement dans les
conversations.

Voir [`docs/configuration/providers.md`](./docs/configuration/providers.md)
et [`docs/configuration/connectors.md`](./docs/configuration/connectors.md)
pour la référence complète.

---

## État réel des fonctionnalités

> **Alpha.** Louis se lance, s'installe et exécute les fonctionnalités
> 🟢 ci-dessous. Quelques zones sont 🟡 partielles ou ⚪ planifiées.
> La source de vérité à jour est
> [`docs/feature-status.md`](./docs/feature-status.md).

### 🟢 Disponible — fonctionnel et testé

- Chat streaming multi-tour, multi-provider, persistance Postgres
- **Orchestrateur multi-agents (Board)** — agents spécialisés (Maestro,
  Recherche, Légifrance, Rédacteur, Relecteur, Citateur), presets, un
  modèle assignable par rôle
- Tool calling : **Légifrance**, **Judilibre**, **BOFIP**, **BODACC**
  (via PISTE), **Pappers**, recherche RAG dans vos documents (pgvector)
- **DocPanel side-by-side** — PDF natif sans toolbar parasite, DOCX
  rendu fidèle via Gotenberg
- **Cmd+K** — palette de commandes globale (conversations, projets,
  documents, workflows, navigation)
- Export Markdown et PDF d'une conversation
- Upload PDF / DOCX / texte jusqu'à 25 Mo, extraction serveur, cap
  à 500 000 caractères
- Hiérarchie de dossiers, versioning v1/v2/v3, projets clients,
  move-to-project depuis chat / conversation / document
- **Analyses tabulaires** style Excel — N colonnes prompts × M
  documents, `generateText({ output })` + Zod, traitement asynchrone
  via `next/server::after`
- **Workflows** — bibliothèque de prompts cabinet réutilisables,
  5 workflows par défaut importables
- **Suivi des coûts** par modèle (€/$), mensuel + all-time
- **Génération de documents** — `generate_document` (DOCX + PDF preview
  Gotenberg) avec schéma typé, `edit_document` avec tracked edits
  accept/reject
- **BYOK chiffré** — clés AES-256-GCM, badges souveraineté FR/UE/US
- **Connecteurs juridiques** — PISTE OAuth (Légifrance, Judilibre,
  BOFIP, BODACC), Pappers
- **MCP-native** — serveurs MCP custom par utilisateur
- **Multi-utilisateur** — NextAuth v5 Credentials + RBAC admin/member
- **Journal d'audit** append-only sur les opérations sensibles
  (auth, users, providers, connecteurs, documents, cabinet)
- **Docker Compose** une commande
- **Sécurité** — rate-limit Redis, headers HTTP OWASP, audit log,
  SSL Postgres strict, sanitization filenames
- **Tests** — 281 tests unitaires Vitest (crypto, chiffrement DEK,
  connecteurs, orchestrateur, RAG, OCR, highlight…) + smoke tests Playwright

#### Ajouts récents

- **PDF → Markdown** — conversion locale pdfjs, souverain, hors-ligne
- **OCR pluggable** — Mistral OCR → vision → Tesseract local `fra`, page
  paramètres dédiée
- **Vue Markdown dans le DocPanel** — bascule PDF / Markdown
- **Chunking RAG markdown-aware** — titre Markdown = nouveau chunk
- **Chiffrement DEK complet (ADR 0005)** — blobs S3 et texte extrait
  chiffrés, XChaCha20 + AES-256-GCM, rétrocompat null-DEK
- **Embedding configurable** — plus limité à Mistral, endpoint libre via `.env`
- **Téléchargement de documents** depuis la page `/documents`
- **Réindexation intelligente** — indexation des nouveaux seulement par défaut,
  dropdown « forcer » pour changer de modèle d'embedding
- **Citations avec surlignage précis** — normalisation Unicode, highlight inline
  `<mark>` via `splitText`, aiguille adaptative 120→60→30 chars, animation pulse
- **Tests étendus** — 281 tests Vitest

### ⚪ Planifié

- Sub-APIs PISTE supplémentaires : JADE (Conseil d'État), INPI
- Project sharing par email entre membres du cabinet
- Internationalisation anglaise
- Veille juridique automatisée — surveillance Légifrance / JADE / BODACC
- Mode SecNumCloud-ready — checklist et configuration documentée
- CSP nonces (durcissement script-src)

---

## Stack technique

- **Framework** : Next.js 16 — App Router, Server Components, React
  Compiler, output `standalone`
- **UI** : shadcn/ui · Tailwind CSS v4 · Tabler Icons · EB Garamond
  (heading) + Geist Sans (body)
- **Base de données** : PostgreSQL 16 + pgvector · Drizzle ORM
- **Auth** : NextAuth v5 — Credentials, sessions JWT signées
- **IA** : Vercel AI SDK v6, multi-providers
- **Cache et rate-limit** : Redis 7
- **Génération PDF fidèle** : Gotenberg (LibreOffice headless HTTP)
- **Tests** : Vitest (unit) + Playwright (E2E smoke)
- **Déploiement** : Docker Compose · Node.js 24 LTS · image
  multi-stage Alpine, user non-root, healthcheck interne

---

## Roadmap

| Milestone | Date cible | Statut |
|---|---|---|
| v0.1 — Fondation publique · orchestrateur mono-agent | 2026-Q2 | ✅ Livré |
| v0.2 — Board multi-agents + connecteurs PISTE étendus (Judilibre, BOFIP, BODACC) + chiffrement DEK des documents + OCR souverain + RAG souverain | 2026-Q2 | ✅ Livré |
| v0.2.x — JADE/INPI, durcissement sécurité, affinage UX | 2026-Q3 | 🟡 En cours |
| v0.3 — i18n, project sharing, config pipeline YAML déclarative | 2027-Q1 | ⚪ À venir |
| v1.0 — Production-ready, documentation complète | 2027 | ⚪ À venir |

---

## Sécurité

Louis est attentif a la protection (clés API providers, identifiants
PISTE/Pappers, hash de mots de passe) et est destiné à un environnement
de travail soumis au secret professionnel. Il est par construction non garanti et deliberement modeste.

- Politique de divulgation responsable : [`SECURITY.md`](./.github/SECURITY.md)
- Modèle de menace : [`docs/security/threat-model.md`](./docs/security/threat-model.md)
- Rotation des secrets : [`docs/security/secret-rotation.md`](./docs/security/secret-rotation.md)
- Sauvegardes chiffrées : [`docs/admin/backups.md`](./docs/admin/backups.md)

Signaler une vulnérabilité : **contact@data-ring.net**.

---

## Contribuer

Louis est encore jeune. Les contributions code externes seront
formellement ouvertes à partir de la v0.2, le temps que les fondations
se stabilisent. D'ici là :

- ⭐ Mettre une étoile au dépôt si l'idée vous intéresse
- 💬 Ouvrir une issue pour discuter d'un cas d'usage, d'un connecteur
  juridique manquant, ou d'une question d'architecture
- 📣 Partager le projet
- Documenter et faire remonter les retours d'experience sur contact@data-ring.net
  

Voir [`CONTRIBUTING.md`](./.github/CONTRIBUTING.md),
[`CODE_OF_CONDUCT.md`](./.github/CODE_OF_CONDUCT.md) et
[`GOVERNANCE.md`](./.github/GOVERNANCE.md).

---

## Crédits

Louis est porté par l'**association DataRing**, au sein de son bac a sable Lab IA, avec l'equipe de benevoles passionnes : 
-France Charruyer, Avocat en Innovation, Technologies avancees et Cybersecurite, 
-Frederic Ollivier Docteur en Informatique,  RSSI et Tech lead Auditor, 
-Clement GINER , ingenierie IA, developpeur



Les dépendances tierces et leurs licences sont documentées dans
[`NOTICE.md`](./NOTICE.md).

---

## Licence

[AGPL-3.0-or-later](./LICENSE) — toute amélioration apportée à une
instance publique de Louis doit revenir à la communauté.

---

<div align="center">

*« Justitia est constans et perpetua voluntas jus suum cuique tribuendi. »*

— Ulpien, *Digeste* 1.1.10.

</div>
