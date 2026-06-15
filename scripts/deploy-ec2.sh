#!/usr/bin/env bash
# Update an existing Logstack EC2 host — API-only by default (no web frontend).
#
# Usage:
#   ./scripts/deploy-ec2.sh
#   DEPLOY_HOST=ubuntu@18.225.219.208 DEPLOY_PATH=~/logstack ./scripts/deploy-ec2.sh
#   ./scripts/deploy-ec2.sh --backup-db
#   ./scripts/deploy-ec2.sh --full-stack   # includes web frontend (not typical for prod)
#
# Requires SSH access to the instance. Set DEPLOY_HOST if your host differs.

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-ubuntu@18.225.219.208}"
DEPLOY_PATH="${DEPLOY_PATH:-~/logstack}"
GIT_REF="${GIT_REF:-main}"
COMPOSE_FILE="docker-compose.api.yml"
FULL_STACK=false
BACKUP_DB=false

usage() {
  cat <<'EOF'
Usage: deploy-ec2.sh [options]

Options:
  --host HOST         SSH target (default: ubuntu@18.225.219.208)
  --path PATH         Repo path on the server (default: ~/logstack)
  --ref REF           Git ref to deploy (default: main)
  --full-stack        Deploy web + api (default: API-only via docker-compose.api.yml)
  --backup-db         pg_dump before updating
  -h, --help          Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      DEPLOY_HOST="$2"
      shift 2
      ;;
    --path)
      DEPLOY_PATH="$2"
      shift 2
      ;;
    --ref)
      GIT_REF="$2"
      shift 2
      ;;
    --full-stack)
      FULL_STACK=true
      shift
      ;;
    --backup-db)
      BACKUP_DB=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "${FULL_STACK}" == "true" ]]; then
  COMPOSE_FILE="docker-compose.yml"
fi

echo "Deploying to ${DEPLOY_HOST}:${DEPLOY_PATH} (ref: ${GIT_REF}, compose: ${COMPOSE_FILE})"

ssh -o BatchMode=yes "${DEPLOY_HOST}" "DEPLOY_PATH='${DEPLOY_PATH}' GIT_REF='${GIT_REF}' COMPOSE_FILE='${COMPOSE_FILE}' BACKUP_DB='${BACKUP_DB}' bash -s" <<'REMOTE'
set -euo pipefail

cd "${DEPLOY_PATH}"

if [[ ! -f .env ]]; then
  echo "Missing .env in ${DEPLOY_PATH}. Copy production secrets before deploying." >&2
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
    echo "postgres container not running; skipping backup" >&2
  fi
fi

git fetch --all --prune
git checkout "${GIT_REF}"
git pull --ff-only origin "${GIT_REF}"

docker compose -f "${COMPOSE_FILE}" up -d --build --remove-orphans

docker compose -f "${COMPOSE_FILE}" ps

api_port="$(docker compose -f "${COMPOSE_FILE}" port api 8080 2>/dev/null | cut -d: -f2 || true)"

if [[ -n "${api_port}" ]]; then
  echo "API reachable on host port ${api_port}"
  curl -fsS "http://127.0.0.1:${api_port}/health" >/dev/null && echo "API health OK"
  curl -fsS "http://127.0.0.1:${api_port}/ready" >/dev/null && echo "API ready OK"
else
  echo "Could not resolve API host port — check API_HOST_PORT in .env" >&2
fi

echo "Deploy finished."
REMOTE

echo "Done."