#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Louis — script de sauvegarde
#
# Sauvegarde :
#   - Le dump Postgres (chiffré symétriquement avec une passphrase distincte)
#   - Le contenu du bucket S3 (rclone / aws-cli côté admin)
#
# Variables requises :
#   DATABASE_URL          Chaîne de connexion Postgres
#   BACKUP_PASSPHRASE     Passphrase pour chiffrer le dump (≠ ENCRYPTION_KEY)
#   BACKUP_DIR            Dossier local où écrire les dumps (default: ./backups)
#
# Pourquoi une passphrase distincte d'ENCRYPTION_KEY :
#   Si vous rotez ENCRYPTION_KEY (re-chiffrer toutes les clés provider en DB),
#   l'ancien backup chiffré avec cette clé devient inrestaurable. Une
#   passphrase de backup indépendante permet la rotation sans perte.
#
# Usage :
#   ./scripts/backup.sh
#
# Restauration :
#   gpg --decrypt louis-2026-05-16.sql.gpg | psql $DATABASE_URL
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL doit être défini}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE doit être défini (≠ ENCRYPTION_KEY)}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
DUMP_PATH="${BACKUP_DIR}/louis-${TIMESTAMP}.sql"
ENCRYPTED_PATH="${DUMP_PATH}.gpg"

mkdir -p "${BACKUP_DIR}"

echo "[backup] pg_dump → ${DUMP_PATH}"
pg_dump \
  --no-owner \
  --no-acl \
  --format=plain \
  --file="${DUMP_PATH}" \
  "${DATABASE_URL}"

echo "[backup] chiffrement gpg → ${ENCRYPTED_PATH}"
gpg \
  --batch \
  --yes \
  --symmetric \
  --cipher-algo AES256 \
  --passphrase "${BACKUP_PASSPHRASE}" \
  --output "${ENCRYPTED_PATH}" \
  "${DUMP_PATH}"

# Sécurité : on supprime le dump en clair immédiatement.
shred -u "${DUMP_PATH}" 2>/dev/null || rm -f "${DUMP_PATH}"

echo "[backup] ✓ ${ENCRYPTED_PATH} ($(du -h "${ENCRYPTED_PATH}" | cut -f1))"
echo ""
echo "  → Pour les documents stockés en S3/MinIO, mirroir séparément :"
echo "    rclone sync louis-storage:/ ./backups/storage-${TIMESTAMP}/"
echo ""
echo "  → Restauration :"
echo "    gpg --decrypt ${ENCRYPTED_PATH} | psql \$DATABASE_URL"
