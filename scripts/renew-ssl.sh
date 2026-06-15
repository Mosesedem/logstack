#!/usr/bin/env bash
# Renew Let's Encrypt certs and reload nginx. Add to cron:
#   0 3 * * * cd /home/ubuntu/logstack && ./scripts/renew-ssl.sh >> /var/log/logstack-certbot.log 2>&1

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

docker run --rm \
  -v logstack_certbot_conf:/etc/letsencrypt \
  -v logstack_certbot_www:/var/www/certbot \
  certbot/certbot renew --webroot -w /var/www/certbot

docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo "Certificate renewal complete: $(date -u +%Y-%m-%dT%H:%M:%SZ)"