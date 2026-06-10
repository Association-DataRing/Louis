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
log()   { printf '  %s\n' "$*"; }
ok()    { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn()  { printf '  \033[33m⚠\033[0m %s\n' "$*"; }
fail()  { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

rand_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32
  else
    head -c 32 /dev/urandom | base64
  fi
}

# Attend que le daemon Docker réponde (jusqu'à ~3 min), en le démarrant au
# besoin. Docker Desktop (Mac) demande au premier lancement d'accepter les
# conditions dans une fenêtre — d'où le message, puis on attend que le
# daemon soit prêt et on poursuit automatiquement.
wait_for_docker() {
  if docker info >/dev/null 2>&1; then return 0; fi
  case "$(uname -s)" in
    Darwin)
      open -a Docker >/dev/null 2>&1 || open -a "Docker Desktop" >/dev/null 2>&1 || true
      log "Docker démarre — si une fenêtre s'ouvre, cliquez « Accepter » pour finaliser." ;;
    Linux)
      if command -v systemctl >/dev/null 2>&1; then
        sudo systemctl start docker >/dev/null 2>&1 || true
      fi ;;
  esac
  printf '  … attente du démarrage de Docker'
  for _ in $(seq 1 90); do
    if docker info >/dev/null 2>&1; then printf '\n'; return 0; fi
    printf '.'; sleep 2
  done
  printf '\n'
  return 1
}

# Installe Docker Desktop sur macOS (téléchargement officiel, pas de Homebrew
# requis). L'utilisateur n'a qu'à valider la fenêtre Docker au 1er lancement.
install_docker_mac() {
  local arch url dmg mnt
  arch="$(uname -m)"
  if [ "$arch" = "arm64" ]; then
    url="https://desktop.docker.com/mac/main/arm64/Docker.dmg"
  else
    url="https://desktop.docker.com/mac/main/amd64/Docker.dmg"
  fi
  bold "Docker n'est pas installé — installation de Docker Desktop (~600 Mo)…"
  dmg="$(mktemp -d)/Docker.dmg"
  curl -fSL --progress-bar "$url" -o "$dmg" \
    || fail "Téléchargement de Docker échoué. Installez-le manuellement : https://docs.docker.com/desktop/install/mac-install/"
  mnt="$(mktemp -d)"
  hdiutil attach "$dmg" -nobrowse -mountpoint "$mnt" >/dev/null \
    || fail "Montage de l'image Docker échoué."
  log "Copie de Docker dans /Applications…"
  cp -R "$mnt/Docker.app" /Applications/ 2>/dev/null || {
    hdiutil detach "$mnt" >/dev/null 2>&1 || true
    fail "Copie échouée. Glissez Docker dans Applications manuellement, lancez-le, puis relancez ce script."
  }
  hdiutil detach "$mnt" >/dev/null 2>&1 || true
  xattr -dr com.apple.quarantine /Applications/Docker.app 2>/dev/null || true
  ok "Docker Desktop installé"
}

# Installe Docker Engine sur Linux via le script officiel (apt/dnf/…).
install_docker_linux() {
  bold "Docker n'est pas installé — installation via le script officiel Docker…"
  if [ "$(id -u)" = "0" ]; then
    curl -fsSL https://get.docker.com | sh || fail "Installation de Docker échouée."
  elif command -v sudo >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sudo sh || fail "Installation de Docker échouée (sudo)."
  else
    fail "Ni root ni sudo disponible. Installez Docker manuellement : https://docs.docker.com/engine/install/"
  fi
}

# Garantit Docker installé ET démarré, sinon l'installe puis le démarre.
ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    case "$(uname -s)" in
      Darwin) install_docker_mac ;;
      Linux)  install_docker_linux ;;
      *) fail "OS non reconnu. Installez Docker manuellement : https://docs.docker.com/get-docker/" ;;
    esac
  fi
  wait_for_docker \
    || fail "Docker ne répond pas. Lancez Docker Desktop, attendez qu'il soit prêt (icône fixe), puis relancez ce script."
  docker compose version >/dev/null 2>&1 \
    || fail "Docker Compose v2 absent. Mettez Docker Desktop à jour (il l'inclut)."
  ok "Docker opérationnel"
}

bold "Louis — installation"

# 1. Prérequis : Docker installé et démarré (installé automatiquement si absent)
ensure_docker

# 2. Dossier + compose ────────────────────────────────────────────────────────
mkdir -p "$LOUIS_DIR"
cd "$LOUIS_DIR"

# On récupère TOUJOURS la dernière version du compose (aucun secret dedans) :
# ré-exécuter ce script vaut donc mise à jour complète de la configuration.
curl -fsSL "$LOUIS_REPO_RAW/$COMPOSE_FILE" -o "$COMPOSE_FILE" \
  || fail "Téléchargement de $COMPOSE_FILE impossible depuis $LOUIS_REPO_RAW"
ok "$COMPOSE_FILE à jour"

# Script de mise à jour pratique déposé dans le dossier d'install :
# l'utilisateur n'a qu'à le lancer (ou ré-exécuter la commande d'install).
cat > update.sh <<'UPD'
#!/usr/bin/env bash
# Met Louis à jour : récupère la dernière image et redémarre. Vos données
# (base, documents) et vos secrets (.env) sont conservés.
set -euo pipefail
cd "$(dirname "$0")"
echo "Mise à jour de Louis…"
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
echo "Louis est à jour."
UPD
chmod +x update.sh

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
    echo "  Mettre à jour : relancez cette commande, ou exécutez $LOUIS_DIR/update.sh"
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
