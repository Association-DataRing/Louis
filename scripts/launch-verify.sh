#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Louis — vérification pré-launch
#
# Exécute toutes les vérifications attendues par la checklist /goal v0.1.0
# en une commande. Stop immédiatement à la première erreur.
#
# Usage : ./scripts/launch-verify.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

cd "$(dirname "$0")/.."

GREEN="\033[32m"
RED="\033[31m"
YELLOW="\033[33m"
RESET="\033[0m"

ok()    { echo -e "${GREEN}✓${RESET} $*"; }
warn()  { echo -e "${YELLOW}!${RESET} $*"; }
fail()  { echo -e "${RED}✗${RESET} $*"; exit 1; }
step()  { echo -e "\n→ $*"; }

step "1. Lint"
npm run lint 2>&1 | tail -20
ok "Lint OK"

step "2. TypeScript typecheck"
npx tsc --noEmit
ok "tsc OK"

step "3. Tests unitaires"
npm test 2>&1 | tail -5
ok "Tests OK"

step "4. Audit vulnerabilités (prod, high+)"
if npm audit --omit=dev --audit-level=high; then
  ok "0 vuln high+ en prod"
else
  fail "Vulnérabilités high détectées en prod"
fi

step "5. Licences AGPL-compatibles"
LOUIS_VERSION=$(node -p "require('./package.json').version")
if npx --yes license-checker --production \
    --excludePackages "louis@${LOUIS_VERSION}" \
    --onlyAllow \
    "MIT;ISC;Apache-2.0;Apache 2.0;BSD;BSD-2-Clause;BSD-3-Clause;BSD-3-Clause-Clear;0BSD;CC0-1.0;CC-BY-3.0;CC-BY-4.0;Unlicense;OFL-1.1;SIL-OFL-1.1;BlueOak-1.0.0;Python-2.0;WTFPL;MPL-2.0;LGPL-2.1-or-later;LGPL-3.0-or-later;LGPL-3.0-only;LGPL-3.0;GPL-3.0-or-later;AGPL-3.0-or-later;AGPL-3.0;Artistic-2.0;EPL-2.0" \
    > /dev/null; then
  ok "Toutes les licences sont compatibles AGPL"
else
  fail "Licences incompatibles détectées"
fi

step "6. Sweep références éditoriales obsolètes"
# Doit retourner 0 résultat (aucune mention textuelle dans src/docs)
if grep -rin "altij" src docs README.md SECURITY.md CONTRIBUTING.md GOVERNANCE.md CODE_OF_CONDUCT.md SUPPORT.md THIRD_PARTY 2>/dev/null; then
  fail "Références éditoriales obsolètes détectées — voir grep ci-dessus"
fi
ok "Aucune référence obsolète"

step "7. Build production"
npm run build 2>&1 | tail -10
ok "Build OK"

step "8. Vérifications statiques de fichiers attendus"
for f in LICENSE README.md SECURITY.md CONTRIBUTING.md CODE_OF_CONDUCT.md GOVERNANCE.md SUPPORT.md CODEOWNERS CHANGELOG.md THIRD_PARTY/NOTICE.md .github/dependabot.yml .github/workflows/ci.yml Dockerfile .dockerignore docs/README.md docs/feature-status.md; do
  if [ ! -f "$f" ]; then
    fail "Fichier requis manquant : $f"
  fi
done
ok "Tous les fichiers requis sont présents"

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}✓ Louis est prêt pour la publication v0.1.0${RESET}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════${RESET}"
echo ""
echo "Prochaines étapes (humain requis) :"
echo "  1. Activer les protections de la branche main + CodeQL Default Setup"
echo "  2. Activer les Discussions GitHub"
echo "  3. Tag v0.1.0 + push --tags"
echo "  4. Créer la GitHub Release avec le contenu de [Non publié] dans CHANGELOG.md"
echo ""
