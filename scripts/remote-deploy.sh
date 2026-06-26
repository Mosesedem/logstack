#!/usr/bin/env bash
# Run on the EC2 host to pull latest code and rebuild the API stack.
# Used by scripts/deploy-ec2.sh and .github/workflows/deploy.yml.
#
# Environment:
#   DEPLOY_PATH     Repo directory (default: /home/ubuntu/logstack)
#   GIT_REF         Branch or tag to deploy (default: main)
#   COMPOSE_FILE    Compose file (default: docker-compose.host.yml)
#   BACKUP_DB       true to pg_dump before update (default: false)
#   API_DOMAIN      Public API hostname for HTTPS checks (default: api.logstack.tech)
#   REQUIRE_HTTPS   true to fail when public health check fails (default: true)

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/home/ubuntu/logstack}"
GIT_REF="${GIT_REF:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.host.yml}"
BACKUP_DB="${BACKUP_DB:-false}"
API_DOMAIN="${API_DOMAIN:-api.logstack.tech}"
REQUIRE_HTTPS="${REQUIRE_HTTPS:-true}"

cd "${DEPLOY_PATH}"

if [[ ! -f .env ]]; then
  echo "Missing .env at ${DEPLOY_PATH}/.env — copy .env.production.example and fill secrets." >&2
  exit 1
fi

# Read API_HOST_PORT from .env without executing arbitrary shell.
API_HOST_PORT="$(grep -E '^API_HOST_PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
API_HOST_PORT="${API_HOST_PORT:-8082}"

if [[ "${BACKUP_DB}" == "true" ]]; then
  if docker compose -f "${COMPOSE_FILE}" ps --status running postgres 2>/dev/null | grep -q postgres; then
    stamp="$(date +%Y%m%d-%H%M%S)"
    backup_file="${DEPLOY_PATH}/backup-${stamp}.sql"
    echo "Backing up database to ${backup_file}"
    docker compose -f "${COMPOSE_FILE}" exec -T postgres \
      pg_dump -U logstack logstack > "${backup_file}"
  else
    echo "postgres not running; skipping backup" >&2
  fi
fi

echo "Fetching ${GIT_REF} in ${DEPLOY_PATH}"
git fetch --all --prune
git checkout "${GIT_REF}"
git pull --ff-only origin "${GIT_REF}"

echo "Building and starting ${COMPOSE_FILE}"
docker compose -f "${COMPOSE_FILE}" up -d --build --remove-orphans
docker compose -f "${COMPOSE_FILE}" ps

# Prefer the mapped host port from compose when it differs from .env.
mapped_port="$(docker compose -f "${COMPOSE_FILE}" port api 8080 2>/dev/null | cut -d: -f2 || true)"
if [[ -n "${mapped_port}" ]]; then
  API_HOST_PORT="${mapped_port}"
fi

echo "Waiting for local health on 127.0.0.1:${API_HOST_PORT}"
local_ok=false
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${API_HOST_PORT}/health" >/dev/null 2>&1; then
    echo "Local health OK"
    local_ok=true
    break
  fi
  sleep 2
done

if [[ "${local_ok}" != "true" ]]; then
  echo "Local health check failed after 60s" >&2
  docker compose -f "${COMPOSE_FILE}" logs --tail 80 api >&2 || true
  exit 1
fi

if curl -fsS --max-time 15 "https://${API_DOMAIN}/health" >/dev/null 2>&1; then
  echo "HTTPS health OK: https://${API_DOMAIN}/health"
  curl -fsS --max-time 15 "https://${API_DOMAIN}/ready" && echo ""
else
  echo "HTTPS health check failed for https://${API_DOMAIN}/health" >&2
  echo "Local API is healthy — check host nginx, DNS, TLS, and Cloudflare." >&2
  if [[ "${REQUIRE_HTTPS}" == "true" ]]; then
    exit 1
  fi
fi

echo "Deploy finished at $(date -u +%Y-%m-%dT%H:%M:%SZ)"