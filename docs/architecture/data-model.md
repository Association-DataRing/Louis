# Modèle de données

Source de vérité : [`../../src/db/schema/`](../../src/db/schema/).

## Diagramme synthétique

```
users (1) ──┬── (N) conversations ── (N) messages
            │        └── projectId → projects
            ├── (N) projects
            ├── (N) provider_keys (encrypted)
            ├── (N) connector_keys (encrypted)
            ├── (N) mcp_servers
            ├── (N) document_folders (self-ref parentFolderId)
            ├── (N) documents ── (N) document_chunks (vector 1024)
            │        └── parentDocumentId → documents (versioning)
            │        └── folderId → document_folders
            │        └── projectId → projects
            ├── (N) workflows
            └── (N) tabular_reviews ── (N) tabular_review_rows

cabinet_settings (singleton id=1)

audit_log (append-only)
```

## Tables principales

### `users`

UUID PK, email unique, name, passwordHash (bcrypt cost 12), avatarUrl,
role (`admin` | `member`), isActive, lastLogin, createdAt.

### `provider_keys` (clés API providers IA, chiffrées)

- `userId` FK
- `type` enum : `mistral` / `scaleway` / `ovh` / `albert` / `anthropic` /
  `openai` / `openai_compatible`
- `label` unique par (user, label)
- `apiKeyCiphertext` + `apiKeyIv` + `apiKeyTag` — blob AES-256-GCM
- `baseUrl` (optionnel, pour openai_compatible)
- `isActive`, `isDefault`, `lastTestedAt`, `lastTestStatus`

### `connector_keys` (PISTE, Pappers, chiffrées)

Même structure que provider_keys mais pour les connecteurs juridiques.
Les credentials sont sérialisés en JSON avant chiffrement (parce qu'un
connecteur peut avoir plusieurs champs : `client_id` + `client_secret`
pour PISTE).

### `documents`

UUID PK, `userId` FK, `filename`, `contentType`, `sizeBytes`,
`storageKey` (clé S3), `extractedText` (texte plein, capé 500k chars),
`extractionStatus` (`ok` / `truncated` / `failed`), `extractionError`,
`parentDocumentId` (auto-référencé pour le versioning), `version` (int),
`folderId` FK, `projectId` FK.

### `document_chunks` (vecteurs RAG)

UUID PK, `documentId` FK, `chunkIndex`, `content` (texte du chunk),
`embedding` (vector(1024), Mistral mistral-embed).

### `conversations` et `messages`

- `conversations` : title, providerKeyId (utilisé par défaut), modelId,
  projectId, pinnedAt, updatedAt
- `messages` : role (`user` / `assistant`), content (text), parts
  (JSONB : array de `{ type, text | toolCallId | toolName | input | output }`
  pour rejouer les pills de tool au reload), inputTokens, outputTokens,
  modelId

### `audit_log`

Append-only. `userId` (acteur, nullable), `action` (kebab-case namespacé),
`target`, `meta` (jsonb), `createdAt`.

### Autres tables

- `document_folders` : self-référencée, hiérarchie illimitée
- `projects` : conteneurs dossier client, scope user
- `tabular_reviews` + `tabular_review_rows` : analyses tabulaires async
  via `next/server::after()`
- `workflows` : bibliothèque de prompts cabinet, scope user
- `mcp_servers` : serveurs MCP par user, avec tools cachés en JSON
- `cabinet_settings` : singleton (id=1) avec nom du cabinet, footer
  des documents générés, mention légale

## Versioning des documents

Un upload "nouvelle version" crée un nouveau `documents.id`, avec
`parentDocumentId` pointant vers la racine de la famille et `version`
incrémenté. La page **Documents** groupe par famille, affichant la
version la plus récente avec un historique repliable.

Cf. `src/app/api/documents/upload/route.ts:replacesId`.

## Migrations

Gérées par **Drizzle Kit** :

```bash
npm run db:generate    # diff schéma TS vs migrations
npm run db:migrate     # applique migrations en attente
npm run db:push        # push direct (dev seulement)
npm run db:studio      # UI navigateur pour explorer la DB
```

Les migrations vivent dans `drizzle/` (généré, pas commité en v0.1 —
prévu pour v0.1.x une fois le schéma stabilisé).
