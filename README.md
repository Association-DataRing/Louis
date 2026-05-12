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

2. **Vos connecteurs, pas les nôtres.** PISTE, Légifrance, Judilibre, JADE,
   BODACC, Pappers, INPI — vous configurez vos accès, vos quotas, vos
   contrats. Louis n'est pas intermédiaire.

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

## Fonctionnalités

### Disponible (v0.1 — alpha)

- 🔐 **Authentification** NextAuth v5 (Credentials, sessions JWT)
- 🔑 **Page Providers IA** — BYOK pour Mistral, Scaleway, OVH, Albert
  (Etalab), Anthropic, OpenAI, et tout endpoint OpenAI-compatible (Ollama,
  vLLM, llama.cpp). Clés chiffrées AES-256-GCM avant stockage. Test de
  connexion intégré. Badges FR / UE / US.
- 🔌 **Page Connecteurs** — PISTE (Légifrance, Judilibre, JADE, INPI,
  BODACC) et Pappers. Credentials chiffrées en blob JSON.
- 💬 **Chat streaming** — multi-tour, sélecteur de provider par
  conversation, persistance auto, system prompt FR anti-hallucination.
- 🐳 **Docker Compose** : Postgres + pgvector, Redis, MinIO en une commande.

### En cours (v0.2)

- 🛠️ **Tool calling** — utiliser PISTE/Pappers comme outils dans le chat
- 📁 **Documents + RAG** — upload, indexation pgvector, citations sourcées
- 🧠 **MCP-native** — chaque cabinet peut ajouter ses propres MCP servers

### Planifié (v0.3+)

- 🧠 **MCP-native** — chaque cabinet peut ajouter ses propres MCP servers
  (l'écosystème Model Context Protocol comme protocole de connecteur standard)
- 🔍 **Veille juridique automatisée** — surveillance Légifrance / JADE / BODACC
- 👥 **Multi-utilisateur + RBAC** — rôles avocat / collaborateur / paralégal
- 📊 **Suivi coûts par provider** — facture mensuelle agrégée
- 🇪🇺 **Mode SecNumCloud-ready** — checklist et configuration documentée

---

## Architecture (cible)

```
┌─────────────────────────────────────────────────────┐
│  Navigateur                                          │
│  └─ Next.js 16 (App Router · Server Components)     │
└─────────────────────────────────────────────────────┘
                       │
┌─────────────────────────────────────────────────────┐
│  Louis (votre serveur)                              │
│  ├─ PostgreSQL + pgvector  (RAG, sessions, audit)   │
│  ├─ Redis                  (cache, rate-limit)      │
│  ├─ Object storage          (vos documents)          │
│  └─ MCP gateway            (connecteurs juridiques) │
└─────────────────────────────────────────────────────┘
       │                              │
       ▼                              ▼
┌──────────────────┐         ┌──────────────────────┐
│ Providers IA     │         │ Connecteurs          │
│ (vos clés)       │         │ (vos accès)          │
│                  │         │                      │
│ Mistral · Albert │         │ PISTE · Légifrance   │
│ Scaleway · OVH   │         │ Judilibre · JADE     │
│ Anthropic · …    │         │ Pappers · BODACC · … │
└──────────────────┘         └──────────────────────┘
```

---

## Stack technique

- **Framework** : Next.js 16 (App Router, Server Components, React Compiler)
- **UI** : shadcn/ui · Tailwind CSS v4 · Tabler Icons
- **Base de données** : PostgreSQL 16 + pgvector · Drizzle ORM
- **Auth** : NextAuth v5 (Credentials, sessions JWT)
- **IA** : Vercel AI SDK v6, multi-providers
- **Cache** : Redis
- **Déploiement** : Docker Compose · Node.js 24

---

## Démarrage rapide

> ⚠️ **Alpha.** L'application n'est pas encore fonctionnelle bout-en-bout.
> Le squelette se lance, mais les fonctionnalités sont en cours de développement.

### Prérequis

- Node.js ≥ 24
- Docker + Docker Compose
- Au moins une clé API d'un provider IA (Mistral, OpenAI, etc.)

### Installation

```bash
git clone https://github.com/D4kooo/louis.git
cd louis
cp .env.example .env
npm install
docker compose up -d
npm run dev
```

Louis tourne sur [http://localhost:3000](http://localhost:3000).

---

## Roadmap publique

Suivez l'avancement sur [GitHub Projects](https://github.com/D4kooo/louis/projects)
(à venir).

| Milestone | Date cible      | Statut       |
| --------- | --------------- | ------------ |
| v0.1 — Fondation publique | 2026-Q2 | 🟡 En cours  |
| v0.2 — Chat + BYOK + 1 connecteur PISTE | 2026-Q3 | ⚪ À venir   |
| v0.3 — RAG + multi-connecteurs | 2026-Q4 | ⚪ À venir   |
| v1.0 — Production-ready, doc complète | 2027     | ⚪ À venir   |

---

## Contribuer

Louis est encore très jeune. Les contributions seront ouvertes dès que les
fondations seront stables (~v0.2).

D'ici là, vous pouvez :

- ⭐ **Mettre une étoile** au repo si l'idée vous plaît
- 💬 **Ouvrir une issue** pour discuter d'un cas d'usage, d'un connecteur
  juridique manquant, ou d'une question d'architecture
- 📣 **Partager** le projet à vos confrères

---

## Crédits

Louis est initié par **[Altij Avocats](https://altij.com)**, cabinet d'avocats
spécialisé en droit du numérique, de l'innovation et de la propriété
intellectuelle.

Le projet s'inspire de l'approche UX de [Mike](https://github.com/willchen96/mike)
(également AGPL-3.0), réécrit intégralement sur une stack Next.js 16 + souveraineté
européenne. Voir [`THIRD_PARTY/NOTICE.md`](./THIRD_PARTY/NOTICE.md) pour le détail.

---

## Licence

[AGPL-3.0-or-later](./LICENSE) — toute amélioration apportée à une instance
publique de Louis doit revenir à la communauté.

> _« Justicia est constans et perpetua voluntas jus suum cuique tribuendi. »_
> — Ulpien, *Digeste* 1.1.10.

