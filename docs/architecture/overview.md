# Architecture — vue d'ensemble

## Diagramme

```
┌─────────────────────────────────────────────────────┐
│  Navigateur                                          │
│  └─ Next.js 16 (App Router · Server Components)     │
│      ├─ Server Components (data fetching)           │
│      ├─ Client Components (chat, DocPanel, Cmd+K)   │
│      ├─ Server Actions (admin, workflows, etc.)     │
│      └─ Streaming API routes (chat, upload)         │
└─────────────────────────────────────────────────────┘
                       │
                       │  HTTPS (reverse proxy en prod)
                       ▼
┌─────────────────────────────────────────────────────┐
│  Louis app (Node.js 24)                             │
│  ├─ Middleware sécurité (CSP, HSTS, …)             │
│  ├─ NextAuth v5 (Credentials + JWT)                 │
│  ├─ Drizzle ORM                                     │
│  ├─ AI SDK v6 (streamText + tool calling)           │
│  ├─ AES-256-GCM crypto pour BYOK                    │
│  └─ Rate-limit Redis (chat / upload / login)        │
└─────────────────────────────────────────────────────┘
       │              │            │            │
       ▼              ▼            ▼            ▼
  PostgreSQL 16    Redis        S3-compat    Gotenberg
  + pgvector                    storage       (DOCX→PDF)
  - users                       - documents
  - conversations
  - messages
  - provider_keys (encrypted)
  - connector_keys (encrypted)
  - document_chunks (vecteurs)
  - audit_log
  - workflows
  - tabular_reviews
       │                              │
       │  appels sortants             │  appels sortants
       ▼  (vos clés)                  ▼  (vos accès)
┌──────────────────┐         ┌──────────────────────┐
│ Providers IA     │         │ Connecteurs          │
│                  │         │                      │
│ Mistral · OpenAI │         │ PISTE (Légifrance)   │
│ Anthropic · OVH  │         │ Pappers              │
│ Scaleway · Albert│         │ + MCP servers du     │
│ + endpoints      │         │   user               │
│   OpenAI-compat  │         │                      │
└──────────────────┘         └──────────────────────┘
```

## Flux : conversation avec document

1. **User** : pose une question, joint un document via le composer
2. **Server Component `/chat/page.tsx`** : authentifie + charge les
   provider keys actifs + documents disponibles + workflows
3. **Client Component `chat-shell.tsx`** : `useChat({ api: "/api/chat" })`
4. **API route `/api/chat`** :
   - Auth check
   - Rate-limit (Redis)
   - Charge la provider key (decrypt AES-256-GCM)
   - Si documents joints : injecte leur contenu en system prompt
   - Construit les `tools` (connecteurs actifs + MCP user + RAG si Mistral)
   - `streamText({ model, tools, ... })` — l'AI SDK gère les tool calls
     en boucle (jusqu'à `stopWhen: stepCountIs(5)`)
   - À chaque `tool-call`, l'exécuteur appelle Légifrance / Pappers / RAG /
     un MCP server, et renvoie un `ToolResult` au modèle
   - `onFinish` : persiste le message assistant + parts JSONB pour rejouer
     les pills de tool au reload
5. **Client** : affiche le stream + rerender les pills + ouvre auto le
   DocPanel si un `generate_document` ou `edit_document` a produit un fichier

## Décisions d'architecture (ADRs)

Voir [`decisions/`](./decisions/).

- [`0001-byok.md`](./decisions/0001-byok.md) — Pourquoi Bring Your Own Key
- [`0002-agpl.md`](./decisions/0002-agpl.md) — Pourquoi AGPL-3.0-or-later
- [`0003-pgvector.md`](./decisions/0003-pgvector.md) — pgvector plutôt qu'un vector DB dédié
- [`0004-mcp-native.md`](./decisions/0004-mcp-native.md) — Support MCP par utilisateur

## Choix qui ne sont pas dans le code

- **Pas d'auto-update du modèle** : l'utilisateur choisit son modèle par
  conversation. Aucun "fallback silencieux" vers GPT-5 si Mistral est down.
- **Pas de cache de réponses IA** : Louis ne cache pas les réponses des
  providers — chaque requête est exécutée en réel, pour éviter une fuite
  inter-utilisateur ou un coût caché à la facturation provider.
- **Pas de telemetry** : aucun appel sortant à un serveur "Louis" pour des
  métriques d'usage. L'admin de l'instance voit les coûts dans
  `/settings/usage` ; rien ne quitte son serveur.
