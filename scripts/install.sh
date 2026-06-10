#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Louis — installeur une commande
#
#   curl -fsSL https://raw.githubusercontent.com/Association-DataRing/Louis/main/scripts/install.sh | bash
#
# Ce script :
#   1. vérifie que Docker (+ plugin compose) est installé et démarré ;
#   2. crée un dossier ./louis avec le docker-compose de production ;
#   3. génère les secrets (.env) — jamais écrasés s'ils existent déjà ;
#   4. télécharge les images et démarre la stack (app, Postgres+pgvector,
#      Redis, MinIO, Gotenberg) ;
#   5. attend que l'app réponde puis ouvre l'assistant de premier lancement.
#
# Variables d'environnement optionnelles :
#   LOUIS_DIR=…        dossier d'installation        (défaut : ./louis)
#   LOUIS_VERSION=…    tag d'image, ex. v0.2.0       (défaut : latest)
#   LOUIS_PORT=…       port HTTP sur la machine      (défaut : 3000)
#   LOUIS_REPO_RAW=…   base raw GitHub (fork/miroir)
#
# Relancer le script est sans danger : il est idempotent.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

LOUIS_DIR="${LOUIS_DIR:-louis}"
LOUIS_PORT="${LOUIS_PORT:-3000}"
LOUIS_REPO_RAW="${LOUIS_REPO_RAW:-https://raw.githubusercontent.com/Association-DataRing/Louis/main}"
COMPOSE_FILE="docker-compose.prod.yml"

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
ok()    { printf '  \033[32m✓\033[0m %s\n' "$*"; }
fail()  { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

rand_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32
  else
    head -c 32 /dev/urandom | base64
  fi
}

bold "Louis — installation"

# 1. Prérequis ────────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 \
  || fail "Docker n'est pas installé. Installez Docker Desktop : https://docs.docker.com/get-docker/"
docker info >/dev/null 2>&1 \
  || fail "Docker est installé mais ne tourne pas. Démarrez Docker Desktop puis relancez ce script."
docker compose version >/dev/null 2>&1 \
  || fail "Le plugin Docker Compose est absent. Mettez Docker à jour (Compose v2 requis)."
ok "Docker opérationnel"

# 2. Dossier + compose ────────────────────────────────────────────────────────
mkdir -p "$LOUIS_DIR"
cd "$LOUIS_DIR"

if [ ! -f "$COMPOSE_FILE" ]; then
  curl -fsSL "$LOUIS_REPO_RAW/$COMPOSE_FILE" -o "$COMPOSE_FILE" \
    || fail "Téléchargement de $COMPOSE_FILE impossible depuis $LOUIS_REPO_RAW"
  ok "$COMPOSE_FILE téléchargé"
else
  ok "$COMPOSE_FILE déjà présent (conservé)"
fi

# 3. Secrets ──────────────────────────────────────────────────────────────────
# ENCRYPTION_KEY chiffre les clés API stockées : la perdre rend les clés
# irrécupérables. On ne régénère donc JAMAIS un .env existant.
if [ ! -f .env ]; then
  umask 177
  {
    echo "# Secrets Louis — générés le $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "# SAUVEGARDEZ CE FICHIER : ENCRYPTION_KEY est irremplaçable."
    echo "POSTGRES_PASSWORD=$(rand_secret | tr -d '/+=' | head -c 32)"
    echo "S3_SECRET_ACCESS_KEY=$(rand_secret | tr -d '/+=' | head -c 32)"
    echo "AUTH_SECRET=$(rand_secret)"
    echo "ENCRYPTION_KEY=$(rand_secret)"
    echo "LOUIS_PORT=$LOUIS_PORT"
    if [ -n "${LOUIS_VERSION:-}" ]; then echo "LOUIS_VERSION=$LOUIS_VERSION"; fi
  } > .env
  umask 022
  ok "Secrets générés dans $LOUIS_DIR/.env (à sauvegarder précieusement)"
else
  ok ".env déjà présent (conservé)"
fi

# 4. Démarrage ────────────────────────────────────────────────────────────────
bold "Téléchargement des images (premier lancement : quelques minutes)…"
docker compose -f "$COMPOSE_FILE" pull --quiet
docker compose -f "$COMPOSE_FILE" up -d
ok "Stack démarrée"

# 5. Attente de l'app ─────────────────────────────────────────────────────────
printf '  … démarrage de Louis'
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:$LOUIS_PORT/api/health" >/dev/null 2>&1; then
    printf '\n'
    ok "Louis répond sur http://localhost:$LOUIS_PORT"
    bold ""
    bold "Installation terminée."
    echo "  Ouvrez http://localhost:$LOUIS_PORT — l'assistant de premier"
    echo "  lancement vous guide : compte administrateur, clé IA, et c'est prêt."
    echo ""
    echo "  Mise à jour :   cd $LOUIS_DIR && docker compose -f $COMPOSE_FILE pull && docker compose -f $COMPOSE_FILE up -d"
    echo "  Arrêt :         cd $LOUIS_DIR && docker compose -f $COMPOSE_FILE down"
    # Ouvre le navigateur quand l'environnement le permet (best-effort).
    if command -v open >/dev/null 2>&1; then open "http://localhost:$LOUIS_PORT" || true
    elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:$LOUIS_PORT" || true
    fi
    exit 0
  fi
  printf '.'
  sleep 2
done

printf '\n'
fail "Louis ne répond pas après 2 minutes. Diagnostic : cd $LOUIS_DIR && docker compose -f $COMPOSE_FILE logs app migrate"
