# Installation bare-metal (sans Docker)

Pour les administrateurs qui veulent piloter chaque composant directement.

## Composants externes

Mettez en place vous-mêmes :

| Service | Version | Notes |
|---|---|---|
| PostgreSQL | ≥ 16 | Avec extension `pgvector` activée |
| Redis | ≥ 7 | Cache + rate-limit |
| Stockage S3-compatible | — | MinIO, Scaleway Object Storage, OVH, AWS S3 |
| Gotenberg (optionnel) | 8 | DOCX → PDF fidèle |

Pointer Louis vers chacun via les variables d'env — cf.
[`../configuration/env-vars.md`](../configuration/env-vars.md).

## Pré-requis Node

- **Node.js 24 LTS** (cf. `.nvmrc`)
- npm ≥ 10

## Build et démarrage

```bash
git clone https://github.com/D4kooo/louis.git
cd louis

# Configuration
cp .env.example .env
# Remplir DATABASE_URL, REDIS_URL, S3_*, AUTH_SECRET, ENCRYPTION_KEY, etc.

npm ci
npm run db:setup
ADMIN_EMAIL=admin@cabinet.fr ADMIN_PASSWORD="..." npm run db:seed

npm run build
npm start
```

L'app écoute sur `http://localhost:3000` (configurable via `PORT`).

## Reverse proxy

Devant Louis, placer Caddy / Nginx / Traefik en HTTPS. Configurer :

- `X-Forwarded-For` correctement (sinon rate-limit login devient global)
- HSTS (déjà servi par Louis en `NODE_ENV=production`, mais doublez en proxy)
- WebSocket / SSE upstream pour les streams chat

Exemple Caddy minimal :

```
louis.exemple.fr {
  reverse_proxy localhost:3000 {
    header_up X-Real-IP {remote}
    header_up X-Forwarded-For {remote}
  }
}
```

## Process supervisor

En prod, utilisez systemd / pm2 / runit. Exemple systemd :

```ini
[Unit]
Description=Louis — IA juridique souveraine
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=louis
WorkingDirectory=/opt/louis
EnvironmentFile=/etc/louis/env
ExecStart=/usr/bin/node /opt/louis/.next/standalone/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Mise à jour

```bash
git pull
npm ci
npm run db:setup       # appliquer les migrations Drizzle
npm run build
# redémarrer le process
systemctl restart louis
```

Lire le `CHANGELOG.md` pour les ruptures de compatibilité (rares en
patch/minor releases).
