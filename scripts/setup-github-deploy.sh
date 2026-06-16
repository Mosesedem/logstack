#!/usr/bin/env bash
# One-time setup: create a deploy SSH key for GitHub Actions → EC2.
# Run on the EC2 server (or via ssh ubuntu@host 'bash -s' < scripts/setup-github-deploy.sh).
#
# After running, add the printed private key to GitHub:
#   Repo → Settings → Secrets and variables → Actions → New repository secret

set -euo pipefail

KEY_PATH="${HOME}/.ssh/logstack_github_deploy"
DEPLOY_PATH="${DEPLOY_PATH:-/home/ubuntu/logstack}"

if [[ -f "${KEY_PATH}" ]]; then
  echo "Deploy key already exists at ${KEY_PATH}"
else
  ssh-keygen -t ed25519 -f "${KEY_PATH}" -N "" -C "logstack-github-actions-deploy"
  chmod 600 "${KEY_PATH}"
  chmod 644 "${KEY_PATH}.pub"
fi

mkdir -p "${HOME}/.ssh"
AUTH_KEYS="${HOME}/.ssh/authorized_keys"
PUB="$(cat "${KEY_PATH}.pub")"

if ! grep -qF "${PUB}" "${AUTH_KEYS}" 2>/dev/null; then
  echo "${PUB}" >> "${AUTH_KEYS}"
  chmod 600 "${AUTH_KEYS}"
  echo "Added public key to ${AUTH_KEYS}"
else
  echo "Public key already in authorized_keys"
fi

PUBLIC_IP="$(curl -fsS --max-time 5 https://checkip.amazonaws.com 2>/dev/null | tr -d '[:space:]' || hostname -I | awk '{print $1}')"

cat <<EOF

================================================================================
GitHub Actions secrets (Repository → Settings → Secrets → Actions)
================================================================================

DEPLOY_KEY
  (paste the entire private key block below, including BEGIN/END lines)

DEPLOY_HOST
  ${PUBLIC_IP}

DEPLOY_USER
  $(whoami)

DEPLOY_PATH
  ${DEPLOY_PATH}

================================================================================
PRIVATE KEY — copy into DEPLOY_KEY secret (shown once; also saved at ${KEY_PATH})
================================================================================
EOF

cat "${KEY_PATH}"

cat <<'EOF'

================================================================================
Optional: create a "production" environment (Settings → Environments) to require
manual approval before deploys, or delete "environment: production" from
.github/workflows/deploy.yml to skip it.

Test: push to main with a change under packages/logstack-go/, or run the
"Deploy API" workflow manually from the Actions tab.
================================================================================
EOF