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

echo ""
echo "Verifying deploy prerequisites..."

fail=0

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is not installed" >&2
  fail=1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose plugin is not available" >&2
  fail=1
fi

if [[ ! -d "${DEPLOY_PATH}" ]]; then
  echo "ERROR: repo not found at ${DEPLOY_PATH}" >&2
  echo "       Clone first: git clone https://github.com/Mosesedem/logstack.git ${DEPLOY_PATH}" >&2
  fail=1
fi

if [[ -d "${DEPLOY_PATH}" ]] && [[ ! -f "${DEPLOY_PATH}/.env" ]]; then
  echo "ERROR: missing ${DEPLOY_PATH}/.env" >&2
  echo "       cp ${DEPLOY_PATH}/.env.production.example ${DEPLOY_PATH}/.env && nano ${DEPLOY_PATH}/.env" >&2
  fail=1
fi

if [[ -d "${DEPLOY_PATH}" ]]; then
  if ! git -C "${DEPLOY_PATH}" remote get-url origin >/dev/null 2>&1; then
    echo "ERROR: ${DEPLOY_PATH} is not a git repository" >&2
    fail=1
  else
    echo "Git remote: $(git -C "${DEPLOY_PATH}" remote get-url origin)"
    if ! git -C "${DEPLOY_PATH}" fetch --all --prune >/dev/null 2>&1; then
      echo "WARN: git fetch failed — ensure the server can reach GitHub (public repo or deploy key)" >&2
    else
      echo "git fetch OK"
    fi
  fi
fi

if [[ "${fail}" -ne 0 ]]; then
  echo ""
  echo "Fix the errors above before configuring GitHub secrets." >&2
  exit 1
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
Next steps
================================================================================

1. Add the four secrets above in GitHub.
2. (Optional) Settings → Environments → create "production" for deploy approval gates.
   Or remove "environment: production" from .github/workflows/deploy.yml to skip it.
3. Push a change under packages/logstack-go/ to main, or run "Deploy API" manually.
4. Full guide: docs/CICD.md

Test manual deploy on the server:
  cd /home/ubuntu/logstack && ./scripts/remote-deploy.sh
================================================================================
EOF