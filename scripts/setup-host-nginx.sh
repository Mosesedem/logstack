#!/usr/bin/env bash
# Install Logstack API nginx site on a shared EC2 host (system nginx on 80/443).
# Run on the server with sudo after API is up on 127.0.0.1:8082.
#
# Usage:
#   ./scripts/setup-host-nginx.sh
#   API_HOST_PORT=8082 ./scripts/setup-host-nginx.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

API_DOMAIN="${API_DOMAIN:-api.logstack.tech}"
API_HOST_PORT="${API_HOST_PORT:-8082}"
SITE_NAME="host-api.logstack.tech.conf"
AVAILABLE="/etc/nginx/sites-available/${SITE_NAME}"
ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-running with sudo..."
  exec sudo API_DOMAIN="${API_DOMAIN}" API_HOST_PORT="${API_HOST_PORT}" "$0" "$@"
fi

sed "s/127.0.0.1:8082/127.0.0.1:${API_HOST_PORT}/g" \
  "${ROOT_DIR}/infra/nginx/${SITE_NAME}" > "${AVAILABLE}"

ln -sf "${AVAILABLE}" "${ENABLED}"
nginx -t
systemctl reload nginx

echo "Nginx site enabled for ${API_DOMAIN} → 127.0.0.1:${API_HOST_PORT}"
echo ""
echo "Next (after DNS A record points here):"
echo "  sudo certbot --nginx -d ${API_DOMAIN}"