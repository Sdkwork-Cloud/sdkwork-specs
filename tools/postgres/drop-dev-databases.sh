#!/usr/bin/env bash
set -euo pipefail

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres_admin_pass}"

DATABASES=(
  sdkwork_ai_dev
  sdkwork_chat_dev
  craw_chat_test
  openchat
)

echo "[sdkwork-postgres] terminating active connections..."
for db in "${DATABASES[@]}"; do
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db}' AND pid <> pg_backend_pid();" \
    >/dev/null || true
done

echo "[sdkwork-postgres] dropping development databases..."
for db in "${DATABASES[@]}"; do
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -c \
    "DROP DATABASE IF EXISTS \"${db}\";"
  echo "  dropped ${db}"
done

echo "[sdkwork-postgres] remaining databases:"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c '\l'

echo "[sdkwork-postgres] to recreate sdkwork_ai_dev with required extensions, run:"
echo "  bash $(dirname "$0")/recreate-dev-database.sh"
