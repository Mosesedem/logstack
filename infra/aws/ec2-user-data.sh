#!/bin/bash
# EC2 User Data — Logstack API production bootstrap (Ubuntu 22.04/24.04).
# Attach as User Data on launch. After boot, SSH in to finish .env + SSL + first deploy.
#
# Security group inbound: 22 (your IP), 80, 443.
# Instance: t3.medium+ (4 GB RAM). Attach an Elastic IP before pointing DNS.
#
# Post-boot (SSH):
#   cd ~/logstack
#   cp .env.production.example .env && nano .env
#   ./scripts/setup-ssl.sh
#   docker compose -f docker-compose.prod.yml up -d --build

set -euo pipefail
exec > /var/log/logstack-user-data.log 2>&1

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y docker.io docker-compose-v2 git curl dnsutils

systemctl enable --now docker
usermod -aG docker ubuntu || true

# Clone repo
sudo -u ubuntu bash <<'UBUNTU'
set -euo pipefail
cd ~
if [[ ! -d logstack ]]; then
  git clone https://github.com/Mosesedem/logstack.git logstack
fi
cd logstack
git pull --ff-only origin main || true

if [[ ! -f .env ]]; then
  cp .env.production.example .env
  echo "EDIT .env with real secrets before going live." >> .env
fi
UBUNTU

echo "Logstack bootstrap complete. Next: SSH in, edit ~/logstack/.env, run ./scripts/setup-ssl.sh, then docker compose -f docker-compose.prod.yml up -d --build"