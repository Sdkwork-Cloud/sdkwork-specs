#!/usr/bin/env bash
# Install PostgreSQL host packages required by SDKWork dev database baselines (Ubuntu 22.04+).
set -euo pipefail

if ! command -v apt-get >/dev/null 2>&1; then
  echo "[sdkwork-postgres] apt-get is required; run this script on Ubuntu/Debian" >&2
  exit 1
fi

PG_MAJOR="${PG_MAJOR:-18}"

PACKAGES=(
  "postgresql-${PG_MAJOR}"
  "postgresql-client-${PG_MAJOR}"
  "postgresql-contrib"
  "postgresql-${PG_MAJOR}-pgvector"
)

echo "[sdkwork-postgres] installing PostgreSQL dev extension packages (PG ${PG_MAJOR})..."
sudo apt-get update -qq
sudo apt-get install -y "${PACKAGES[@]}"

echo "[sdkwork-postgres] verifying packages..."
dpkg -l | grep -E "postgresql-${PG_MAJOR}|pgvector|contrib" || true

if command -v pg_config >/dev/null 2>&1; then
  echo "[sdkwork-postgres] pg_config version: $(pg_config --version)"
fi

echo "[sdkwork-postgres] Ubuntu PostgreSQL extension packages ready."
