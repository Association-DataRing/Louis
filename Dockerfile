# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Louis — image production multi-stage
#
# Repose sur `output: "standalone"` (cf. next.config.ts) qui génère un bundle
# Next minimal dans `.next/standalone/`. Image finale ~250 MB (vs 1+ GB pour
# une build avec node_modules complet).
#
# Build :
#   docker build -t louis:dev .
#
# Run :
#   docker run --rm -p 3000:3000 --env-file .env louis:dev
#
# Note LibreOffice : l'image n'inclut PAS LibreOffice. Pour le rendu DOCX→PDF
# fidèle, lancer un sidecar Gotenberg séparé (cf. docker-compose.yml) et
# pointer `GOTENBERG_URL=http://gotenberg:3000` côté Louis.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:24-alpine AS deps
WORKDIR /app
# libc6-compat : utile pour certains binaires natifs (sharp, etc.)
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Placeholders nécessaires au build Next (la vraie config est injectée au run).
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV AUTH_SECRET=build_placeholder_secret_long_enough_for_nextauth_validation
ENV ENCRYPTION_KEY=build_placeholder_key_32_chars_long_for_aes256_scrypt_test

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Migrator — image one-shot qui applique le schéma sur la base AVANT le
# démarrage de l'app (service `migrate` du docker-compose.prod.yml).
#
# Pourquoi une image séparée : le runner standalone ne contient ni drizzle-kit
# ni les sources du schéma (c'est ce qui le maintient à ~250 MB). Le schéma
# Louis s'applique par `drizzle-kit push` (déclaratif, idempotent) — `--force`
# car le conteneur n'a pas de TTY pour confirmer interactivement.
#
# Build : docker build --target migrator -t louis-migrate .
# Run   : docker run --rm -e DATABASE_URL=… louis-migrate
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json drizzle.config.ts ./
COPY src/db ./src/db
COPY scripts/setup-db.ts ./scripts/setup-db.ts

ENV NODE_ENV=production
CMD ["sh", "-c", "npx tsx scripts/setup-db.ts && npx drizzle-kit push --force"]

# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# User non-root pour l'exécution
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Public assets (favicon, icon.svg, etc.) + sortie standalone de Next
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Health probe interne (utilisée par compose / k8s si pas de probe HTTP externe)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
