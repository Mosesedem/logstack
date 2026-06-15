#!/usr/bin/env bash
# Issue or renew Let's Encrypt certificate for api.logstack.tech on EC2.
# Run on the server from the repo root after DNS points to this host.
#
# Usage:
#   ./scripts/setup-ssl.sh
#   CERTBOT_EMAIL=you@logstack.tech API_DOMAIN=api.logstack.tech ./scripts/setup-ssl.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

API_DOMAIN="${API_DOMAIN:-api.logstack.tech}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

if [[ -z "${CERTBOT_EMAIL}" ]]; then
  if [[ -f .env ]]; then
    # shellcheck disable=SC1091
    source <(grep -E '^(CERTBOT_EMAIL|API_DOMAIN)=' .env | sed 's/^/export /')
  fi
fi

if [[ -z "${CERTBOT_EMAIL}" ]]; then
  echo "Set CERTBOT_EMAIL (Let's Encrypt account email)." >&2
  exit 1
fi

echo "Domain: ${API_DOMAIN}"
echo "Checking DNS resolves to this host..."

resolved_ip="$(dig +short "${API_DOMAIN}" | tail -1)"
public_ip="$(curl -fsS --max-time 5 https://checkip.amazonaws.com 2>/dev/null | tr -d '[:space:]' || true)"

if [[ -z "${resolved_ip}" ]]; then
  echo "DNS for ${API_DOMAIN} does not resolve yet. Add an A record first." >&2
  exit 1
fi

if [[ -n "${public_ip}" && "${resolved_ip}" != "${public_ip}" ]]; then
  echo "Warning: ${API_DOMAIN} → ${resolved_ip} but this host is ${public_ip}." >&2
  echo "Certificate issuance may fail until DNS propagates." >&2
fi

# Bootstrap nginx (HTTP only) for ACME webroot challenge
cp infra/nginx/nginx.api.bootstrap.conf /tmp/nginx.bootstrap.conf
sed -i.bak "s/api.logstack.tech/${API_DOMAIN}/g" /tmp/nginx.bootstrap.conf 2>/dev/null \
  || sed -i '' "s/api.logstack.tech/${API_DOMAIN}/g" /tmp/nginx.bootstrap.conf

docker volume create logstack_certbot_conf 2>/dev/null || true
docker volume create logstack_certbot_www 2>/dev/null || true

docker rm -f logstack-nginx-bootstrap 2>/dev/null || true
docker run -d --name logstack-nginx-bootstrap \
  -p 80:80 \
  -v /tmp/nginx.bootstrap.conf:/etc/nginx/nginx.conf:ro \
  -v logstack_certbot_www:/var/www/certbot \
  nginx:1.27-alpine

trap 'docker rm -f logstack-nginx-bootstrap 2>/dev/null || true' EXIT

sleep 2

docker run --rm \
  -v logstack_certbot_conf:/etc/letsencrypt \
  -v logstack_certbot_www:/var/www/certbot \
  certbot/certbot certonly \
  --webroot -w /var/www/certbot \
  --email "${CERTBOT_EMAIL}" \
  --agree-tos --no-eff-email \
  -d "${API_DOMAIN}"

docker rm -f logstack-nginx-bootstrap
trap - EXIT

# Patch production nginx config if using a custom domain
if [[ "${API_DOMAIN}" != "api.logstack.tech" ]]; then
  sed -i.bak "s/api.logstack.tech/${API_DOMAIN}/g" infra/nginx/nginx.api.conf 2>/dev/null \
    || sed -i '' "s/api.logstack.tech/${API_DOMAIN}/g" infra/nginx/nginx.api.conf
fi

# Map docker volume names to compose project (logstack_* prefix from directory name)
echo ""
echo "Certificate issued. Start the production stack:"
echo "  docker compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "Verify:"
echo "  curl -fsS https://${API_DOMAIN}/health"
echo "  curl -fsS https://${API_DOMAIN}/ready"