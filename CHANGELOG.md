# Changelog

Toutes les évolutions notables sont documentées ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Versionnement : [SemVer](https://semver.org/lang/fr/).

## [Non publié]

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

**Documents (`/documents`)**
- Upload PDF / DOCX / texte jusqu'à 25 Mo
- Stockage S3-compatible (MinIO en dev, Scaleway/OVH/AWS en prod)
- Extraction texte serveur : pdf-parse v2 + mammoth
- Cap à 500 000 caractères avec badge "tronqué"
- Liste avec icônes par type, taille formatée, état d'extraction

**Paramètres (`/settings`)**
- Affichage email / dernière connexion / date de création
- Changement de nom affiché
- Changement de mot de passe (bcrypt.compare + bcrypt.hash 12 rounds,
  min 10 caractères, validation zod)

**Quincaillerie**
- GitHub Actions : CI lint + build sur push/PR vers main
- CONTRIBUTING.md, SECURITY.md, CHANGELOG.md, .nvmrc (Node 24)
- Issue templates (bug.yml, feature.yml, config.yml) et PR template
- README marketing avec badges, manifeste, roadmap publique

### À venir (v0.2+)
- RAG (chunking + embeddings + pgvector) pour documents volumineux
- Connecteurs supplémentaires (Judilibre direct, JADE direct, BODACC, INPI)
- Support MCP-native — chaque cabinet plug ses propres MCP servers
- Multi-utilisateur + RBAC (rôles avocat / collaborateur / paralégal)
- Suivi de coûts par provider
- Mobile responsive (sidebar drawer)
- Mode SecNumCloud-ready
