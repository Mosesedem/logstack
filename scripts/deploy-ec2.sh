#!/usr/bin/env bash
# Deploy Logstack API to EC2 (production: nginx + TLS + API + Postgres + Redis).
#
# Usage:
#   ./scripts/deploy-ec2.sh
#   ./scripts/deploy-ec2.sh --backup-db
#   ./scripts/deploy-ec2.sh --direct     # no nginx; exposes API on API_HOST_PORT (8082)
#
# Requires SSH access. Set DEPLOY_HOST if your host differs.

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-ubuntu@18.225.219.208}"
DEPLOY_PATH="${DEPLOY_PATH:-~/logstack}"
GIT_REF="${GIT_REF:-main}"
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DB=false
API_DOMAIN="${API_DOMAIN:-api.logstack.tech}"

usage() {
  cat <<'EOF'
Usage: deploy-ec2.sh [options]

Options:
  --host HOST         SSH target (default: ubuntu@18.225.219.208)
  --path PATH         Repo path on the server (default: ~/logstack)
  --ref REF           Git ref to deploy (default: main)
  --direct            Use docker-compose.api.yml (host port, no nginx/TLS)
  --backup-db         pg_dump before updating
  -h, --help          Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) DEPLOY_HOST="$2"; shift 2 ;;
    --path) DEPLOY_PATH="$2"; shift 2 ;;
    --ref) GIT_REF="$2"; shift 2 ;;
    --direct) COMPOSE_FILE="docker-compose.api.yml"; shift ;;
    --backup-db) BACKUP_DB=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

echo "Deploying to ${DEPLOY_HOST}:${DEPLOY_PATH} (ref: ${GIT_REF}, compose: ${COMPOSE_FILE})"

ssh -o BatchMode=yes "${DEPLOY_HOST}" \
  "DEPLOY_PATH='${DEPLOY_PATH}' GIT_REF='${GIT_REF}' COMPOSE_FILE='${COMPOSE_FILE}' BACKUP_DB='${BACKUP_DB}' API_DOMAIN='${API_DOMAIN}' bash -s" <<'REMOTE'
set -euo pipefail

cd "${DEPLOY_PATH}"

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.production.example to .env and fill secrets." >&2
  exit 1
fi

if [[ "${BACKUP_DB}" == "true" ]]; then
  if docker compose -f "${COMPOSE_FILE}" ps --status running postgres >/dev/null 2>&1; then
    stamp="$(date +%Y%m%d-%H%M%S)"
    backup_file="backup-${stamp}.sql"
    echo "Backing up database to ${backup_file}"
    pg_container="$(docker compose -f "${COMPOSE_FILE}" ps -q postgres)"
    docker exec "${pg_container}" pg_dump -U logstack logstack > "${backup_file}"
  else
    echo "postgres not running; skipping backup" >&2
  fi
fi

git fetch --all --prune
git checkout "${GIT_REF}"
git pull --ff-only origin "${GIT_REF}"

docker compose -f "${COMPOSE_FILE}" up -d --build --remove-orphans
docker compose -f "${COMPOSE_FILE}" ps

if [[ "${COMPOSE_FILE}" == "docker-compose.prod.yml" ]]; then
  if curl -fsS --max-time 10 "https://${API_DOMAIN}/health" >/dev/null 2>&1; then
    echo "HTTPS health OK: https://${API_DOMAIN}/health"
    curl -fsS --max-time 10 "https://${API_DOMAIN}/ready" >/dev/null && echo "HTTPS ready OK"
  else
    echo "HTTPS check failed — run ./scripts/setup-ssl.sh if this is first deploy" >&2
    docker compose -f "${COMPOSE_FILE}" logs --tail 30 nginx api >&2 || true
  fi
else
  api_port="$(docker compose -f "${COMPOSE_FILE}" port api 8080 2>/dev/null | cut -d: -f2 || true)"
  if [[ -n "${api_port}" ]]; then
    curl -fsS "http://127.0.0.1:${api_port}/health" >/dev/null && echo "API health OK on port ${api_port}"
  fi
fi

echo "Deploy finished."
REMOTE

echo "Done."