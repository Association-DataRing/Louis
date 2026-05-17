<div align="center">

# Louis

### L'IA juridique souveraine, sous votre contrôle.

[![CI](https://github.com/D4kooo/louis/actions/workflows/ci.yml/badge.svg)](https://github.com/D4kooo/louis/actions/workflows/ci.yml)
[![Licence : AGPL-3.0](https://img.shields.io/badge/Licence-AGPL--3.0-000091)](./LICENSE)
[![Status : Alpha](https://img.shields.io/badge/Status-Alpha-orange)]()
[![Made in France](https://img.shields.io/badge/Made_in-France-000091?labelColor=FFFFFF)]()

Une plateforme d'intelligence artificielle open-source pour les professions juridiques.
Pensée pour les cabinets d'avocats, les directions juridiques, et les juristes
qui veulent garder **leurs clés, leurs données, et leur infrastructure**.

**La réponse française à [Mike OSS](https://github.com/willchen96/mike)**
— même philosophie open-source, même richesse fonctionnelle (chat,
DocPanel side-by-side, projets, analyses tabulaires, workflows), avec en
plus : connecteur Légifrance (via PISTE), connecteur Pappers, providers
souverains (Mistral, Scaleway, OVH, Albert / Etalab), **suivi des coûts
par modèle**, et hébergement 100 % chez vous.

</div>

---

## Pourquoi Louis ?

Les outils d'IA juridique disponibles aujourd'hui imposent un choix difficile :
**confier vos données clients à un SaaS américain**, ou **renoncer à l'IA**.

Louis propose une troisième voie : un logiciel libre, auto-hébergeable, qui
orchestre **vos propres** fournisseurs IA et **vos propres** sources
juridiques. Le secret professionnel n'est plus négociable.

> **Le nom.** Louis fait référence à Louis IX rendant la justice sous le chêne
> de Vincennes — figure fondatrice de la justice française. La technologie peut
> changer ; la mission de la profession, non.

---

## Le manifeste

1. **Vos clés, pas les nôtres.** Louis fonctionne en *Bring Your Own Key* :
   vous branchez vos propres comptes Mistral, Scaleway, OVH, Anthropic, OpenAI,
   ou un modèle auto-hébergé. **Aucun appel IA ne transite par nous.**

2. **Vos connecteurs, pas les nôtres.** PISTE (Légifrance), Pappers — vous
   configurez vos accès, vos quotas, vos contrats. Louis n'est pas
   intermédiaire.

3. **Vos données, chez vous.** PostgreSQL local, pgvector local, fichiers
   chiffrés sur **votre** stockage (S3 compatible, MinIO, Scaleway, OVH).
   Docker Compose en une commande.

4. **Open-source AGPL-3.0.** Le code est lisible, modifiable, auditable. Toute
   amélioration apportée à un déploiement public doit revenir à la communauté.
   *Et il n'y aura jamais de version "premium" cachée du moteur.*

5. **Souverain par défaut.** Les fournisseurs européens sont en première
   ligne ; les fournisseurs américains restent disponibles mais optionnels.
   Vous choisissez où va chaque requête.

---

## État réel des fonctionnalités

> **Alpha.** Louis se lance, s'installe et exécute les fonctionnalités listées
> 🟢 ci-dessous. Quelques zones sont encore 🟡 partielles ou ⚪ planifiées. La
> source de vérité à jour est [`docs/feature-status.md`](./docs/feature-status.md).

### 🟢 Disponible — testé fonctionnel

**Chat & raisonnement**
- 💬 Chat streaming multi-tour, multi-provider, persistance auto en Postgres
- 🔧 Tool calling : **Légifrance** (via PISTE), **Pappers**, recherche
  sémantique dans vos documents (RAG pgvector)
- 📑 **DocPanel side-by-side** — preview PDF natif (sans toolbar parasite),
  rendu DOCX fidèle via Gotenberg / LibreOffice
- 📌 Épingler les conversations + recherche locale dans la sidebar
- ⌘ **Cmd+K** — palette de commandes globale (conversations, projets,
  documents, workflows, navigation)
- 📤 Export Markdown ou PDF (impression navigateur) d'une conversation

**Documents**
- 📄 Upload PDF / DOCX / texte jusqu'à 25 Mo, extraction texte serveur,
  cap à 500 k caractères
- 🧠 RAG : chunking + embeddings Mistral + recherche vectorielle pgvector
- 🗂️ Hiérarchie de dossiers (sous-dossiers illimités, breadcrumb)
- 🕰️ Versioning v1 / v2 / v3 — historique repliable, projet conservé
- 🗃️ Projets : conteneurs dossier client, move-to-project depuis chat,
  conversation et document

**Productivité avocat**
- 📊 **Analyses tabulaires** style Excel : N colonnes prompts × M documents,
  extraction structurée via `generateObject` + Zod, traitement async via
  `next/server::after()` avec concurrency configurable
- 📚 **Workflows** : bibliothèque de prompts cabinet réutilisables —
  5 workflows juridiques par défaut importables (résumé d'arrêt, analyse
  de clause, comparaison de contrats, due diligence rapide, note de
  synthèse)
- 💰 **Suivi des coûts** par modèle (€ / $), mensuel + all-time, pill
  visible dans l'en-tête du chat

**Génération de documents (IA → fichier)**
- 📝 `generate_document` — DOCX + PDF de preview Gotenberg, schéma typé
  (titres, paragraphes, listes, blockquotes, tableaux, sauts de page)
- ✏️ `edit_document` — édits suivis `::before / ::after / ::reason` avec
  carte cliquable accept/reject

**Providers & connecteurs (BYOK)**
- 🔑 **Providers IA** : Mistral, Scaleway, OVH AI Endpoints, Albert
  (Etalab), Anthropic, OpenAI, et tout endpoint OpenAI-compatible
  (Ollama, vLLM, llama.cpp). Clés chiffrées AES-256-GCM. Badges
  souveraineté FR / UE / US affichés partout
- 🔌 **Connecteurs juridiques** : PISTE (Légifrance) + Pappers (entreprises,
  dirigeants, bénéficiaires)
- 🧩 **MCP-native** : connectez vos propres serveurs MCP par utilisateur

**Multi-utilisateur**
- 🔐 NextAuth v5 (Credentials, JWT) + RBAC admin / member
- 👥 Page admin : création, désactivation, changement de rôle, suppression
- 📜 Journal d'audit append-only pour les opérations sensibles sur les
  comptes (création / désactivation / changement de rôle / suppression)

**Infrastructure**
- 🐳 **Docker Compose** une commande : Postgres + pgvector, Redis, MinIO,
  Gotenberg
- 🛡️ Enveloppe `ToolResult` uniforme — le modèle reçoit `{ ok, reason,
  error }` au lieu d'un `throw` opaque (clé manquante, OAuth expiré, rate
  limit 429, timeout, 5xx)
- ✅ Smoke tests E2E Playwright (11 routes principales × authentification
  × interactions de base)

### 🟡 Partiel — utilisable mais à affiner

- Citations cliquables avec surlignage de la cible (la propagation
  `targetText` existe, l'UX du surlignage demande encore de la finition
  selon les types de PDF)
- Journal d'audit pour les opérations providers / connecteurs /
  suppressions de documents / connexions (infrastructure prête, wiring à
  compléter — voir [`docs/feature-status.md`](./docs/feature-status.md))
- SSL Postgres en production : détection automatique mais `rejectUnauthorized`
  doit être renforcé via `DATABASE_SSL_REJECT_UNAUTHORIZED=true`

### ⚪ Planifié pour v0.2

- **Sub-APIs PISTE étendues** : Judilibre (Cour de cassation), JADE
  (Conseil d'État), INPI, BODACC
- **Rate-limiting Redis** sur les routes API publiques
- **Headers HTTP de sécurité** par middleware (CSP strict, HSTS,
  X-Frame-Options, X-Content-Type-Options)
- **Project sharing** par email entre membres du cabinet
- **EditCard accept/reject** sur suggestions d'édition (UI back-end existe,
  flow apply complet à terminer)
- **i18n anglais**
- **Veille juridique automatisée** — surveillance Légifrance / JADE / BODACC
- **Mode SecNumCloud-ready** — checklist et configuration documentée

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Navigateur                                          │
│  └─ Next.js 16 (App Router · Server Components)     │
└─────────────────────────────────────────────────────┘
                       │
┌─────────────────────────────────────────────────────┐
│  Louis (votre serveur)                              │
│  ├─ PostgreSQL + pgvector  (RAG, sessions, audit)   │
│  ├─ Redis                  (cache, jobs futurs)     │
│  ├─ Object storage          (vos documents)          │
│  ├─ Gotenberg              (DOCX → PDF fidèle)      │
│  └─ MCP gateway            (connecteurs juridiques) │
└─────────────────────────────────────────────────────┘
       │                              │
       ▼                              ▼
┌──────────────────┐         ┌──────────────────────┐
│ Providers IA     │         │ Connecteurs          │
│ (vos clés)       │         │ (vos accès)          │
│                  │         │                      │
│ Mistral · Albert │         │ PISTE · Légifrance   │
│ Scaleway · OVH   │         │ Pappers              │
│ Anthropic · …    │         │                      │
└──────────────────┘         └──────────────────────┘
```

---

## Stack technique

- **Framework** : Next.js 16 (App Router, Server Components, React Compiler)
- **UI** : shadcn/ui · Tailwind CSS v4 · Tabler Icons · EB Garamond (heading)
  + Geist Sans (body)
- **Base de données** : PostgreSQL 16 + pgvector · Drizzle ORM
- **Auth** : NextAuth v5 (Credentials, sessions JWT)
- **IA** : Vercel AI SDK v6, multi-providers
- **Cache** : Redis
- **Génération PDF fidèle** : Gotenberg (LibreOffice headless via HTTP)
- **Déploiement** : Docker Compose · Node.js 24

---

## Démarrage rapide

### Prérequis

- Node.js ≥ 24
- Docker + Docker Compose
- Au moins une clé API d'un provider IA (Mistral recommandé — c'est le
  seul provider qui fournit aussi les embeddings nécessaires pour le RAG
  en v0.1)

### Installation

```bash
git clone https://github.com/D4kooo/louis.git
cd louis
cp .env.example .env
# Générer AUTH_SECRET et ENCRYPTION_KEY :
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env

npm install
docker compose up -d        # Postgres, Redis, MinIO, Gotenberg
npm run db:setup            # création schéma

# Génère un mot de passe admin fort et l'affiche une seule fois — copiez-le.
ADMIN_PW="$(openssl rand -base64 16)"
echo "Admin password : $ADMIN_PW"
ADMIN_EMAIL=admin@louis.local ADMIN_PASSWORD="$ADMIN_PW" npm run db:seed

npm run dev
```

> ⚠️ **Ne déployez jamais avec un mot de passe trivial.** Le seed refuse les
> mots de passe de moins de 12 caractères. Utilisez `openssl rand` ou un
> gestionnaire de mots de passe.

Louis tourne sur [http://localhost:3000](http://localhost:3000). Connectez-vous
avec `admin@louis.local` et le mot de passe généré ci-dessus, puis :

1. **Settings → Providers** : ajoutez votre clé Mistral (active le RAG)
2. **Settings → Connecteurs** (optionnel) : PISTE et/ou Pappers
3. **Workflows → Importer la bibliothèque suggérée** : 5 prompts juridiques
   prêts à l'emploi
4. Uploadez un document, posez une question, observez le DocPanel s'ouvrir

### Tests E2E

Smoke tests Playwright contre une instance locale :

```bash
ADMIN_EMAIL=admin@louis.local ADMIN_PASSWORD="$(openssl rand -base64 16)" npm run db:seed
npm run dev   # ou: npm run build && npm start

# Dans un autre terminal
npx playwright install --with-deps chromium  # une fois
npm run test:e2e            # CLI
npm run test:e2e:ui         # mode UI interactif
```

Variables utiles : `E2E_BASE_URL`, `E2E_EMAIL`, `E2E_PASSWORD`. Voir
[`tests/e2e/README.md`](./tests/e2e/README.md).

---

## Roadmap publique

| Milestone                                | Date cible | Statut         |
| ---------------------------------------- | ---------- | -------------- |
| v0.1 — Fondation publique                | 2026-Q2    | 🟡 En cours    |
| v0.1.x — Sub-APIs PISTE étendues + sécu durcie | 2026-Q3    | ⚪ À venir     |
| v0.2 — i18n + project sharing            | 2026-Q4    | ⚪ À venir     |
| v1.0 — Production-ready, doc complète    | 2027       | ⚪ À venir     |

---

## Contribuer

Louis est encore jeune. Les contributions externes seront ouvertes dès que les
fondations seront stables (~v0.2). D'ici là, vous pouvez :

- ⭐ **Mettre une étoile** au repo si l'idée vous plaît
- 💬 **Ouvrir une issue** pour discuter d'un cas d'usage, d'un connecteur
  juridique manquant, ou d'une question d'architecture
- 📣 **Partager** le projet à vos confrères

Voir [`CONTRIBUTING.md`](./CONTRIBUTING.md), [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
et [`GOVERNANCE.md`](./GOVERNANCE.md).

---

## Sécurité

Voir [`SECURITY.md`](./SECURITY.md) pour la politique de divulgation
responsable et les bonnes pratiques de déploiement. Pour signaler une
vulnérabilité, écrire à **security@data-ring.net**.

---

## Crédits

Louis est initié par **l'association DataRing**, qui porte une vision d'une
souveraineté numérique concrète pour les professions juridiques.

Le projet s'inspire de l'approche UX de [Mike](https://github.com/willchen96/mike)
(également AGPL-3.0), réécrit intégralement sur une stack Next.js 16 + souveraineté
européenne. Voir [`THIRD_PARTY/NOTICE.md`](./THIRD_PARTY/NOTICE.md) pour le détail.

---

## Licence

[AGPL-3.0-or-later](./LICENSE) — toute amélioration apportée à une instance
publique de Louis doit revenir à la communauté.

> _« Justicia est constans et perpetua voluntas jus suum cuique tribuendi. »_
> — Ulpien, *Digeste* 1.1.10.
