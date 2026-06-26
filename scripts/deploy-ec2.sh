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
COMPOSE_FILE="docker-compose.host.yml"
BACKUP_DB=false
API_DOMAIN="${API_DOMAIN:-api.logstack.tech}"

usage() {
  cat <<'EOF'
Usage: deploy-ec2.sh [options]

Options:
  --host HOST         SSH target (default: ubuntu@18.225.219.208)
  --path PATH         Repo path on the server (default: ~/logstack)
  --ref REF           Git ref to deploy (default: main)
  --prod              Use docker-compose.prod.yml (Docker nginx + bundled Postgres/Redis)
  --direct            Use docker-compose.api.yml (all-in-one with local Postgres/Redis)
  --backup-db         pg_dump before updating
  -h, --help          Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) DEPLOY_HOST="$2"; shift 2 ;;
    --path) DEPLOY_PATH="$2"; shift 2 ;;
    --ref) GIT_REF="$2"; shift 2 ;;
    --prod) COMPOSE_FILE="docker-compose.prod.yml"; shift ;;
    --direct) COMPOSE_FILE="docker-compose.api.yml"; shift ;;
    --backup-db) BACKUP_DB=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

echo "Deploying to ${DEPLOY_HOST}:${DEPLOY_PATH} (ref: ${GIT_REF}, compose: ${COMPOSE_FILE})"

ssh -o BatchMode=yes "${DEPLOY_HOST}" \
  "DEPLOY_PATH='${DEPLOY_PATH}' GIT_REF='${GIT_REF}' COMPOSE_FILE='${COMPOSE_FILE}' BACKUP_DB='${BACKUP_DB}' API_DOMAIN='${API_DOMAIN}' bash -s" \
  < "$(dirname "$0")/remote-deploy.sh"

echo "Done."