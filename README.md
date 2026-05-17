<div align="center">

# Louis

### L'intelligence juridique, strictement souveraine.

[![CI](https://github.com/D4kooo/louis/actions/workflows/ci.yml/badge.svg)](https://github.com/D4kooo/louis/actions/workflows/ci.yml)
[![Licence : AGPL-3.0](https://img.shields.io/badge/Licence-AGPL--3.0-000091)](./LICENSE)
[![Status : Alpha](https://img.shields.io/badge/Status-Alpha-orange)](#état-réel-des-fonctionnalités)
[![Made in France](https://img.shields.io/badge/Made_in-France-000091?labelColor=FFFFFF)]()

Plateforme d'intelligence artificielle open-source pour les professions
juridiques. Conçue par l'**association DataRing** pour les cabinets
d'avocats, les directions juridiques et les juristes qui refusent de
confier leur secret professionnel à un service tiers.

**Vos clés. Vos données. Votre infrastructure.**

</div>

---

## Sommaire

1. [Le problème](#le-problème)
2. [Ce que Louis fait](#ce-que-louis-fait)
3. [Le manifeste](#le-manifeste)
4. [Architecture](#architecture)
5. [Démarrage](#démarrage)
6. [Configuration](#configuration)
7. [État réel des fonctionnalités](#état-réel-des-fonctionnalités)
8. [Stack technique](#stack-technique)
9. [Roadmap](#roadmap)
10. [Sécurité](#sécurité)
11. [Contribuer](#contribuer)
12. [Licence](#licence)

---

## Le problème

Les outils d'IA juridique grand public posent un dilemme inacceptable
pour la profession : pour bénéficier des modèles les plus capables, il
faut envoyer les pièces de ses clients chez un éditeur de SaaS, le plus
souvent américain, dont les engagements de confidentialité s'arrêtent
là où commencent ses obligations de coopération avec une autorité
étrangère.

L'alternative — renoncer à l'IA — n'est pas tenable. Les délais
compressent, les volumes documentaires explosent, les confrères
équipés vont plus vite.

Louis propose une troisième voie : un logiciel libre, auto-hébergeable,
qui orchestre **vos propres** fournisseurs d'IA et **vos propres**
sources juridiques. Aucun appel ne transite par DataRing. Aucune donnée
n'est partagée avec qui que ce soit hors de votre infrastructure.

> **Le nom.** Louis fait référence à Louis IX rendant la justice sous
> le chêne de Vincennes — figure fondatrice de la justice française.
> La technologie change ; la mission de la profession, non.

---

## Ce que Louis fait

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

## Le manifeste

1. **Vos clés, pas les nôtres.** Louis fonctionne en *Bring Your Own
   Key*. Vous branchez vos comptes Mistral, Scaleway, OVH, Anthropic,
   OpenAI, Albert, ou un modèle auto-hébergé. **Aucun appel IA ne
   transite par DataRing.**

2. **Vos connecteurs, pas les nôtres.** PISTE (Légifrance), Pappers —
   vous configurez vos accès, vos quotas, vos contrats. Louis
   orchestre, n'intermédie pas.

3. **Vos données, chez vous.** PostgreSQL local, pgvector local,
   fichiers chiffrés sur **votre** stockage (S3 compatible : MinIO,
   Scaleway, OVH, AWS). Docker Compose en une commande.

4. **Open-source AGPL-3.0.** Code lisible, modifiable, auditable.
   Toute amélioration apportée à une instance publique de Louis
   doit revenir à la communauté. Il n'y aura jamais de version
   « premium » cachée du moteur.

5. **Souverain par défaut.** Les fournisseurs européens sont en
   première ligne dans l'interface ; les fournisseurs américains
   restent disponibles mais explicitement étiquetés. Vous choisissez
   où va chaque requête.

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
| Clé Mistral | requise pour le RAG (les embeddings sont fournis uniquement par Mistral en v0.1) | [console.mistral.ai](https://console.mistral.ai) |

> Pour les autres modèles (Anthropic, OpenAI, Scaleway, OVH, Albert),
> les clés sont **optionnelles** et configurables une fois Louis lancé.

### Installation

**1. Cloner et préparer les secrets**

```bash
git clone https://github.com/D4kooo/louis.git
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
> Linux (cf. [`CONTRIBUTING.md`](./CONTRIBUTING.md)).

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
| Workflows pré-importés | `Cmd+K` puis « workflow » | 5 résultats |

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
- Tool calling : **Légifrance** (via PISTE), **Pappers**, recherche
  RAG dans vos documents (pgvector)
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
- **Connecteurs juridiques** — PISTE OAuth (Légifrance), Pappers
- **MCP-native** — serveurs MCP custom par utilisateur
- **Multi-utilisateur** — NextAuth v5 Credentials + RBAC admin/member
- **Journal d'audit** append-only sur les opérations sensibles
  (auth, users, providers, connecteurs, documents, cabinet)
- **Docker Compose** une commande
- **Sécurité** — rate-limit Redis, headers HTTP OWASP, audit log,
  SSL Postgres strict, sanitization filenames
- **Smoke tests** Playwright (11 routes principales) + unit tests
  Vitest (15 tests sur crypto et rate-limit)

### 🟡 Partiel — utilisable mais à affiner

- Citations cliquables avec surlignage de la cible (propagation
  `targetText` ok, UX du highlight à valider par type de PDF)

### ⚪ Planifié pour v0.2

- Sub-APIs PISTE étendues : Judilibre (Cour de cassation), JADE
  (Conseil d'État), INPI, BODACC
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
| v0.1 — Fondation publique | 2026-Q2 | 🟡 En cours |
| v0.1.x — Sub-APIs PISTE étendues + sécurité durcie | 2026-Q3 | ⚪ À venir |
| v0.2 — i18n + project sharing | 2026-Q4 | ⚪ À venir |
| v1.0 — Production-ready, documentation complète | 2027 | ⚪ À venir |

---

## Sécurité

Louis manipule des secrets sensibles (clés API providers, identifiants
PISTE/Pappers, hash de mots de passe) et est destiné à un environnement
de travail soumis au secret professionnel.

- Politique de divulgation responsable : [`SECURITY.md`](./SECURITY.md)
- Modèle de menace : [`docs/security/threat-model.md`](./docs/security/threat-model.md)
- Rotation des secrets : [`docs/security/secret-rotation.md`](./docs/security/secret-rotation.md)
- Sauvegardes chiffrées : [`docs/admin/backups.md`](./docs/admin/backups.md)

Signaler une vulnérabilité : **security@data-ring.net**.

---

## Contribuer

Louis est encore jeune. Les contributions code externes seront
formellement ouvertes à partir de la v0.2, le temps que les fondations
se stabilisent. D'ici là :

- ⭐ Mettre une étoile au dépôt si l'idée vous intéresse
- 💬 Ouvrir une issue pour discuter d'un cas d'usage, d'un connecteur
  juridique manquant, ou d'une question d'architecture
- 📣 Partager le projet à vos confrères et consœurs

Voir [`CONTRIBUTING.md`](./CONTRIBUTING.md),
[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) et
[`GOVERNANCE.md`](./GOVERNANCE.md).

---

## Crédits

Louis est porté par l'**association DataRing**, qui défend une vision
d'une souveraineté numérique concrète pour les professions juridiques
françaises.

Les dépendances tierces et leurs licences sont documentées dans
[`THIRD_PARTY/NOTICE.md`](./THIRD_PARTY/NOTICE.md).

---

## Licence

[AGPL-3.0-or-later](./LICENSE) — toute amélioration apportée à une
instance publique de Louis doit revenir à la communauté.

---

<div align="center">

*« Justicia est constans et perpetua voluntas jus suum cuique tribuendi. »*

— Ulpien, *Digeste* 1.1.10.

</div>
