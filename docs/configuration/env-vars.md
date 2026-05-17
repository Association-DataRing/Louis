# Variables d'environnement

Référence exhaustive. La source de vérité est [`../../.env.example`](../../.env.example).

## Application

| Variable | Requis | Défaut | Description |
|---|---|---|---|
| `NODE_ENV` | non | `development` | `production` active HSTS, désactive le logger texte humain |
| `NEXT_PUBLIC_APP_URL` | non | `http://localhost:3000` | URL publique de l'app, utilisée par certains links générés serveur |
| `PORT` | non | `3000` | Port d'écoute Next |
| `HOSTNAME` | non | `0.0.0.0` | Bind address (utile en container) |

## Base de données

| Variable | Requis | Défaut | Description |
|---|---|---|---|
| `DATABASE_URL` | **oui** | — | Chaîne Postgres. Format : `postgresql://user:pass@host:port/db` |
| `DATABASE_SSL` | non | `false` | Force SSL même sans `sslmode=` dans l'URL |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | non | `true` | Refuser les certificats non signés. **Ne mettre `false` que pour un Postgres self-hosted avec cert auto-signé.** |

## Redis

| Variable | Requis | Défaut | Description |
|---|---|---|---|
| `REDIS_URL` | non | `redis://localhost:6379` | Utilisé pour le rate-limit. Si Redis est down, fail-open (autorise mais log) |

## Stockage S3-compatible

| Variable | Requis | Défaut | Description |
|---|---|---|---|
| `S3_ENDPOINT` | **oui en prod** | — | URL du provider S3 (vide → AWS default) |
| `S3_REGION` | non | `eu-west-3` | Région bucket |
| `S3_BUCKET` | non | `louis` | Nom du bucket (créé auto au premier upload si possible) |
| `S3_ACCESS_KEY_ID` | **oui** | — | |
| `S3_SECRET_ACCESS_KEY` | **oui** | — | |
| `S3_FORCE_PATH_STYLE` | non | auto | `true` pour MinIO. Détecté auto si `S3_ENDPOINT` contient `localhost` |

## Authentification

| Variable | Requis | Défaut | Description |
|---|---|---|---|
| `AUTH_SECRET` | **oui** | — | Secret JWT NextAuth. **Générer via `openssl rand -base64 32`**. Différent entre environnements. |

## Chiffrement

| Variable | Requis | Défaut | Description |
|---|---|---|---|
| `ENCRYPTION_KEY` | **oui** | — | Clé maîtresse AES-256-GCM pour les provider keys et credentials connecteurs. **Générer via `openssl rand -base64 32`**. Sa rotation invalide toutes les clés stockées. |

## Génération de documents

| Variable | Requis | Défaut | Description |
|---|---|---|---|
| `GOTENBERG_URL` | non | — | URL Gotenberg pour le rendu DOCX→PDF. Fallback : LibreOffice local, puis HTML mammoth. Cf. [`installation/docker-compose.md`](../installation/docker-compose.md) |

## Rate-limiting

Toutes les limites s'appliquent **par utilisateur authentifié** sauf
`login` qui s'applique **par IP**. Mettre à `0` désactive le bucket.

| Variable | Défaut | Description |
|---|---|---|
| `RATE_LIMIT_CHAT_PER_MINUTE` | `30` | Requêtes chat / minute / user |
| `RATE_LIMIT_UPLOAD_PER_HOUR` | `60` | Uploads document / heure / user |
| `RATE_LIMIT_LOGIN_PER_15MIN` | `10` | Tentatives login / 15 min / IP |

## Providers IA (fallback global, optionnel)

Ces variables servent uniquement de **fallback** si aucun user n'a configuré
de clé via l'UI. Louis privilégie toujours la configuration par-user
(Settings → Providers).

| Variable | Description |
|---|---|
| `MISTRAL_API_KEY` | https://console.mistral.ai/ |
| `SCALEWAY_API_KEY` + `SCALEWAY_PROJECT_ID` | https://console.scaleway.com/ |
| `OVH_AI_ENDPOINTS_API_KEY` | https://endpoints.ai.cloud.ovh.net/ |
| `ALBERT_API_KEY` | https://albert.api.etalab.gouv.fr/ |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/ |
| `OPENAI_API_KEY` | https://platform.openai.com/ |
| `OPENAI_COMPATIBLE_BASE_URL` + `OPENAI_COMPATIBLE_API_KEY` | Endpoint générique (Ollama, vLLM, llama.cpp) |

## Connecteurs juridiques (fallback global, optionnel)

| Variable | Description |
|---|---|
| `PISTE_CLIENT_ID` + `PISTE_CLIENT_SECRET` | https://piste.gouv.fr/ — passerelle commune Légifrance / Judilibre / JADE / INPI / BODACC |
| `PAPPERS_API_KEY` | https://www.pappers.fr/api |
