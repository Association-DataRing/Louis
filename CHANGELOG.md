# Changelog

Toutes les évolutions notables sont documentées ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Versionnement : [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté
- Bootstrap initial Next.js 16 + React 19 + Tailwind v4 + shadcn/ui
- Authentification NextAuth v5 (Credentials, sessions JWT)
- Chiffrement AES-256-GCM (`src/lib/crypto.ts`) avec dérivation scrypt
  depuis `ENCRYPTION_KEY` — utilisé pour toutes les clés tierces stockées
- Schéma Drizzle : `users`, `provider_keys`, `conversations`, `messages`,
  `connector_keys`
- Page `/providers` (BYOK) — catalogue de 7 providers (Mistral, Scaleway,
  OVH, Albert/Etalab, Anthropic, OpenAI, endpoint OpenAI-compatible) avec
  badges de souveraineté FR / UE / US, test de connexion via `/models`
- Page `/connectors` — catalogue PISTE (passerelle Légifrance / Judilibre /
  JADE / INPI / BODACC) et Pappers ; credentials JSON chiffrés en blob
- Chat streaming `/chat` via AI SDK v6 — sidebar conversations, sélecteur
  de provider par message, badge souveraineté, persistance auto, system
  prompt FR anti-hallucination
- Docker Compose : Postgres 16 + pgvector, Redis 7, MinIO
- GitHub Actions : CI lint + build sur PR/push
- Documentation : `README`, `CONTRIBUTING`, `SECURITY`, templates issues/PR
- `THIRD_PARTY/NOTICE.md` — attribution Mike (inspiration UX, AGPL-3.0)

### Non encore disponible
- Tool calling depuis le chat vers les connecteurs (RAG juridique)
- Documents + indexation pgvector
- Support MCP-native
- Multi-utilisateur + RBAC
- Suivi de coûts par provider
