# ADR 0003 — pgvector plutôt qu'un vector DB dédié

- **Statut** : adopté
- **Date** : 2026
- **Décideur** : association DataRing

## Contexte

Louis a besoin d'une recherche sémantique (RAG) sur les documents uploadés
par les utilisateurs. Options :

1. **Pinecone / Weaviate / Qdrant managé** — vector DB cloud dédié,
   excellente performance à grande échelle, dépendance externe + coût
   récurrent
2. **Vector DB auto-hébergé** (Weaviate, Qdrant, Milvus) — autonome mais
   ajoute un service à déployer / maintenir
3. **pgvector** dans Postgres existant — extension officielle Postgres,
   pas de service additionnel, performance correcte jusqu'à quelques
   millions de vecteurs

## Décision

**pgvector** sur l'instance Postgres existante.

## Conséquences

### Positives

- Un seul service à déployer (Postgres) au lieu de deux
- Transactions cross-table : on peut joindre `document_chunks` aux
  `documents` dans la même query (cf. `src/lib/rag/search.ts`)
- Backup unifié (un seul `pg_dump` couvre tout)
- Souveraineté maximale : aucun service vectoriel externe à intégrer
- Performance largement suffisante pour le volume typique d'un cabinet
  (10k-100k documents → < 10M chunks → query < 50ms avec un index HNSW)

### Négatives

- Au-delà de plusieurs dizaines de millions de chunks, pgvector
  commence à perdre face aux DB dédiées. Pas un sujet pour v0.1, à
  re-évaluer si un cabinet géant arrive
- Index HNSW pgvector consomme de la RAM (mais largement absorbable sur
  une machine de prod 16-32 GB)

### Implications

- Le `docker-compose.yml` utilise `pgvector/pgvector:pg16` (Postgres 16
  avec pgvector pré-installé)
- Le schéma `document_chunks` utilise `vector(1024)` (taille Mistral
  `mistral-embed`)
- L'index est créé via Drizzle migrations (à venir : pour l'instant,
  recherche sur l'ensemble — performant jusqu'à ~100k chunks)
- En v0.2 : add `CREATE INDEX USING hnsw (embedding vector_cosine_ops)`
  pour les déploiements gros volume
