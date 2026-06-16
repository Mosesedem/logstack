#!/usr/bin/env bash
# Switch from external Postgres/Redis (Neon, Upstash) to Docker-managed services.
# Run on the EC2 server from the repo root.
#
# Usage:
#   ./scripts/migrate-to-docker-datastores.sh           # backup + reconfigure .env
#   ./scripts/migrate-to-docker-datastores.sh --no-backup

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

SKIP_BACKUP=false
if [[ "${1:-}" == "--no-backup" ]]; then
  SKIP_BACKUP=true
fi

ENV_FILE="${ROOT_DIR}/.env"
BACKUP_DIR="${ROOT_DIR}/backups"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing .env — copy .env.production.example first." >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
stamp="$(date +%Y%m%d-%H%M%S)"

if [[ "${SKIP_BACKUP}" == "false" ]] && grep -q "^DATABASE_URL=" "${ENV_FILE}"; then
  # shellcheck disable=SC1091
  source <(grep -E '^DATABASE_URL=' "${ENV_FILE}" | sed 's/^/export /')
  if [[ -n "${DATABASE_URL:-}" ]] && [[ "${DATABASE_URL}" != *"@postgres:"* ]]; then
    backup_file="${BACKUP_DIR}/neon-pre-docker-${stamp}.sql"
    echo "Backing up external database to ${backup_file}"
    if command -v pg_dump >/dev/null 2>&1; then
      pg_dump "${DATABASE_URL}" > "${backup_file}" || echo "Warning: pg_dump failed (install postgresql-client?)" >&2
    else
      echo "pg_dump not found — skip DB backup or install: sudo apt install postgresql-client" >&2
    fi
  fi
fi

cp "${ENV_FILE}" "${BACKUP_DIR}/.env.before-docker-${stamp}"

if ! grep -q "^POSTGRES_PASSWORD=" "${ENV_FILE}" || grep -q "CHANGE_ME" "${ENV_FILE}" 2>/dev/null; then
  pw="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
  if grep -q "^POSTGRES_PASSWORD=" "${ENV_FILE}"; then
    sed -i.bak "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pw}|" "${ENV_FILE}"
  else
    echo "POSTGRES_PASSWORD=${pw}" >> "${ENV_FILE}"
  fi
  echo "Set POSTGRES_PASSWORD in .env"
fi

# shellcheck disable=SC1091
source <(grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB)=' "${ENV_FILE}" | sed 's/^/export /')

POSTGRES_USER="${POSTGRES_USER:-logstack}"
POSTGRES_DB="${POSTGRES_DB:-logstack}"

set_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "${ENV_FILE}"; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "${ENV_FILE}"
  else
    echo "${key}=${value}" >> "${ENV_FILE}"
  fi
}

set_env "DATABASE_URL" "postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable"
set_env "REDIS_URL" "redis://redis:6379"

grep -q "^POSTGRES_USER=" "${ENV_FILE}" || echo "POSTGRES_USER=${POSTGRES_USER}" >> "${ENV_FILE}"
grep -q "^POSTGRES_DB=" "${ENV_FILE}" || echo "POSTGRES_DB=${POSTGRES_DB}" >> "${ENV_FILE}"
grep -q "^API_HOST_PORT=" "${ENV_FILE}" || echo "API_HOST_PORT=8082" >> "${ENV_FILE}"

rm -f "${ENV_FILE}.bak"

echo ""
echo "Updated .env for Docker Postgres + Redis."
echo "Start the stack:"
echo "  docker compose -f docker-compose.host.yml up -d --build"
echo ""
echo "Restore a Neon backup into Docker Postgres (if you created one):"
echo "  cat backups/neon-pre-docker-*.sql | docker compose -f docker-compose.host.yml exec -T postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}"