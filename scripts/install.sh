#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Louis — lanceur de l'installeur interactif (macOS + Linux)
#
#   curl -fsSL https://raw.githubusercontent.com/Association-DataRing/Louis/main/scripts/install.sh | bash
#
# Ce fichier n'est plus qu'un raccourci : il vérifie Node ≥ 18 puis lance
# l'installeur TUI publié via npx. Toute la logique (Docker, configuration,
# compte administrateur, clé IA, démarrage) vit dans l'installeur :
#
#   packages/create-louis  →  npx -y github:Association-DataRing/Louis#installer
#
# Windows : utilisez plutôt scripts/install.ps1 (PowerShell) :
#   irm https://raw.githubusercontent.com/Association-DataRing/Louis/main/scripts/install.ps1 | iex
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

INSTALLER="${LOUIS_INSTALLER:-github:Association-DataRing/Louis#installer}"

red()  { printf '\033[31m%s\033[0m\n' "$*" >&2; }

node_major() {
  command -v node >/dev/null 2>&1 || return 1
  node -e 'process.exit(parseInt(process.versions.node) >= 18 ? 0 : 1)' 2>/dev/null
}

if ! command -v node >/dev/null 2>&1 || ! node_major; then
  red "Louis a besoin de Node.js ≥ 18 pour son installeur."
  red ""
  red "Installez Node (LTS) puis relancez cette commande :"
  case "$(uname -s)" in
    Darwin) red "  • macOS  : brew install node   (ou https://nodejs.org/)" ;;
    Linux)  red "  • Linux  : https://nodejs.org/  (ou votre gestionnaire de paquets)" ;;
  esac
  red "  • Toutes plateformes : https://nodejs.org/"
  exit 1
fi

# `< /dev/tty` : l'installeur est interactif ; branché sur le vrai terminal,
# il fonctionne même quand ce script est lui-même lu depuis un pipe
# (curl … | bash n'a pas de stdin interactif par défaut).
#
# On teste l'OUVRABILITÉ réelle de /dev/tty, pas ses droits : `[ -r /dev/tty ]`
# est vrai même sans terminal contrôlant (CI, conteneur, nohup), mais la
# redirection `< /dev/tty` échoue alors avec « Device not configured ». On
# tente donc de l'ouvrir ; à défaut, mode non-interactif (--yes + LOUIS_*).
if { : < /dev/tty; } 2>/dev/null; then
  exec npx -y "$INSTALLER" "$@" < /dev/tty
else
  exec npx -y "$INSTALLER" "$@"
fi
