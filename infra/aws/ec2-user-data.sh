#!/bin/bash
# EC2 User Data script for Logstack on AWS (Amazon Linux 2023 / Ubuntu)
# Attach this as User Data when launching an EC2 instance (t3.medium+ recommended).
# It installs Docker + Compose, clones the repo, sets up a basic .env (edit first!), and starts the full stack.
#
# Usage tips:
# 1. Create a .env file with real secrets (or fetch from SSM Parameter Store / Secrets Manager in a more advanced version of this script).
# 2. For production: build/push images to ECR and pull instead of building on every launch.
# 3. Security group: allow 80, 443 (and 22). Consider placing behind ALB.
# 4. For CDN: Create a CloudFront distribution with origin = this EC2 (or ALB), behaviors for /_next/static/* (Cache 1 year, immutable), other static, and pass-through for /v1/* and WS.
# 5. After launch: ssh in, `docker compose logs -f`, test https://your-domain/health and the dashboard.

set -euo pipefail

# --- Basic system prep (Amazon Linux 2023 style; works on Ubuntu too with minor diffs) ---
yum update -y || apt-get update -y
yum install -y docker git || apt-get install -y docker.io git

# Docker Compose plugin (v2)
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

systemctl enable --now docker
usermod -aG docker ec2-user || true

# --- Clone (or in real CI/CD: pull pre-built images) ---
cd /opt
if [ ! -d logstack ]; then
  git clone https://github.com/Mosesedem/logstack.git logstack
fi
cd logstack

# --- Prepare production environment ---
# IMPORTANT: Replace or fetch real values. Never commit secrets.
cat > .env << 'ENVEOF'
DATABASE_URL=postgres://logstack:CHANGE_ME_STRONG@postgres:5432/logstack?sslmode=disable
REDIS_URL=redis://redis:6379
JWT_SECRET=CHANGE_ME_32BYTE_BASE64_OR_LONGER
NEXTAUTH_SECRET=CHANGE_ME_ANOTHER_32BYTE
NEXTAUTH_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com
ENV=production
PORT=8080

# Web (public URLs — these are baked into the web image at build time)
NEXT_PUBLIC_API_URL=https://your-domain.com/v1
NEXT_PUBLIC_WS_URL=wss://your-domain.com/v1/stream
NEXT_PUBLIC_LOGSTACK_API_KEY=ls_your_dashboard_key_here

# Optional services
# RESEND_API_KEY=re_...
# PAYSTACK_SECRET_KEY=sk_...
# PAYSTACK_PUBLIC_KEY=pk_...
# FCM_SERVICE_ACCOUNT_PATH=/app/fcm.json   # mount a secret
ENVEOF

# For a more secure setup, fetch .env or individual params from AWS SSM:
# aws ssm get-parameter --name /logstack/prod/env --with-decryption --query Parameter.Value --output text > .env

# --- (Optional) SSL for nginx ---
mkdir -p infra/nginx/ssl
# Place real certs here or run certbot in a sidecar / on host.

# --- Start the stack (web + api + dbs) ---
# This uses the updated docker-compose.yml which now includes the web service.
docker compose up -d --build

echo "Logstack stack started. Check with: docker compose ps && docker compose logs -f web api"
echo "Access the dashboard on port 3000 (or front it with nginx on 80/443 + CloudFront for CDN)."
