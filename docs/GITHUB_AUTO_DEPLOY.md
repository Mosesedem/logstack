# GitHub Auto-Deploy — Logstack API to EC2

Automatically deploy the Logstack API to production when you push to `main`.

This setup matches the **shared EC2 host** in production:

- API runs in Docker via `docker-compose.host.yml` on `127.0.0.1:8082`
- Host nginx terminates TLS for `https://api.logstack.tech`
- Postgres (Neon) and Redis (Upstash) are external — configured in the server `.env`

---

## Overview

```
Developer pushes to main
        │
        ▼
GitHub Actions (.github/workflows/deploy.yml)
        │
        ├─ Job 1: build-api
        │     Verify the Go API Docker image builds (CI gate)
        │
        └─ Job 2: deploy
              SSH → EC2
              git pull --ff-only origin main
              docker compose -f docker-compose.host.yml up -d --build
              curl https://api.logstack.tech/health
              curl https://api.logstack.tech/ready
```

**Workflow file:** `.github/workflows/deploy.yml`

---

## When deploys run

### Automatic (push to `main`)

A deploy triggers only when the push changes files under:

| Path | Why |
| ---- | --- |
| `packages/logstack-go/**` | Go API source |
| `docker-compose.host.yml` | Production compose |
| `docker-compose.prod.yml` | Alternate prod compose |
| `docker-compose.api.yml` | Direct-access compose |
| `infra/**` | Nginx / AWS scripts |
| `scripts/deploy-ec2.sh` | Manual deploy script |
| `.github/workflows/deploy.yml` | The workflow itself |

Pushes that only touch the web app, mobile app, or docs **do not** trigger an API deploy.

### Manual

GitHub → **Actions** → **Deploy API** → **Run workflow**

Use this to redeploy without a code change, or to retry a failed run.

---

## One-time setup

### Prerequisites

- EC2 instance running with Logstack API already healthy
- Repo cloned at `/home/ubuntu/logstack` on the server
- Server `.env` configured (Neon, Upstash `rediss://`, `JWT_SECRET`, etc.)
- `https://api.logstack.tech/health` returns OK

See [AWS_PRODUCTION.md](./AWS_PRODUCTION.md) for the full production bootstrap.

### Step 1 — Create a deploy SSH key on EC2

SSH into the server and run:

```bash
ssh ubuntu@18.225.219.208
cd ~/logstack
git pull --ff-only origin main
./scripts/setup-github-deploy.sh
```

This script:

1. Generates `~/.ssh/logstack_github_deploy` (ed25519 key pair)
2. Adds the public key to `~/.ssh/authorized_keys`
3. Prints the **private key** and the GitHub secret values to use

> Keep the private key secret. Only paste it into GitHub Actions secrets — never commit it.

### Step 2 — Add GitHub repository secrets

In GitHub: **Repository → Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
| ------ | ----- |
| `DEPLOY_KEY` | Full private key from setup script (`-----BEGIN OPENSSH PRIVATE KEY-----` … `-----END …`) |
| `DEPLOY_HOST` | `18.225.219.208` (EC2 Elastic IP) |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_PATH` | `/home/ubuntu/logstack` |

To retrieve the private key again:

```bash
ssh ubuntu@18.225.219.208 'cat ~/.ssh/logstack_github_deploy'
```

### Step 3 — (Optional) Production environment

The workflow uses `environment: production`. You can:

- **Create it:** Settings → Environments → New environment → `production`
  - Add protection rules (required reviewers) to approve each deploy
- **Or remove it:** delete `environment: production` from `.github/workflows/deploy.yml` if you want deploys to run immediately with no gate

### Step 4 — Verify

1. Make a small change under `packages/logstack-go/` (or run the workflow manually)
2. Push to `main`
3. Open **Actions** → watch **Deploy API**
4. Confirm the deploy job ends green and health checks pass

---

## What happens on the server during deploy

The workflow SSHs in and runs:

```bash
cd /home/ubuntu/logstack
git fetch --all --prune
git checkout main
git pull --ff-only origin main
docker compose -f docker-compose.host.yml up -d --build --remove-orphans
```

Then it verifies:

- `http://127.0.0.1:8082/health` (local API)
- `https://api.logstack.tech/health` (public, through Cloudflare + nginx)
- `https://api.logstack.tech/ready` (DB + Redis)

The API container is rebuilt from source on the server. The workflow does **not** pull a pre-built image from a registry — it builds on EC2 (same as `./scripts/deploy-ec2.sh`).

---

## Manual deploy (without GitHub)

From your laptop:

```bash
./scripts/deploy-ec2.sh
```

With a database backup first:

```bash
./scripts/deploy-ec2.sh --backup-db
```

On the server directly:

```bash
cd ~/logstack
git pull --ff-only origin main
docker compose -f docker-compose.host.yml up -d --build --remove-orphans
```

---

## Troubleshooting

### Workflow fails: "Missing DEPLOY_KEY, DEPLOY_HOST, or DEPLOY_USER"

Repository secrets are not set. Complete [Step 2](#step-2--add-github-repository-secrets).

### Workflow fails: "Permission denied (publickey)"

- `DEPLOY_KEY` secret is wrong or truncated (must include full BEGIN/END block)
- Public key not in `~/.ssh/authorized_keys` — re-run `./scripts/setup-github-deploy.sh`

### Workflow fails: "Missing .env on server"

The server needs `/home/ubuntu/logstack/.env`. Copy from `.env.production.example` and fill secrets.

### Build passes, deploy fails on health check

```bash
ssh ubuntu@18.225.219.208
docker compose -f ~/logstack/docker-compose.host.yml logs --tail 50 api
curl http://127.0.0.1:8082/health
```

Common causes:

- Redis URL must be `rediss://` for Upstash (TLS)
- Neon DB connection string wrong or DB unreachable
- API still running migrations (wait and redeploy)

### Deploy runs but site still shows old behavior

- Confirm the push actually changed a path listed in [When deploys run](#when-deploys-run)
- Check Actions log — did `git pull` get the latest commit?
- `docker compose … up -d --build` must complete without cache-only skip; check build output in Actions SSH step

### Want deploys on every push to main (no path filter)?

Edit `.github/workflows/deploy.yml` and remove the `paths:` block under `on.push`.

---

## Security notes

- Use a **dedicated deploy key** (`logstack_github_deploy`), not your personal SSH key
- The deploy key only needs shell access to pull and run Docker on the server
- Restrict EC2 security group: port 22 from trusted IPs if possible
- GitHub secrets are encrypted; the private key is never stored in the repo
- The workflow deletes `~/.ssh/deploy_key` on the runner after each job

---

## Related docs

| Doc | Contents |
| --- | -------- |
| [AWS_PRODUCTION.md](./AWS_PRODUCTION.md) | Domain, TLS, nginx, Neon, Upstash, first-time EC2 setup |
| [AWS_EC2_DOCKER_DEPLOY.md](./AWS_EC2_DOCKER_DEPLOY.md) | Quick update commands for an existing EC2 host |
| `.github/workflows/deploy.yml` | Workflow source |
| `scripts/setup-github-deploy.sh` | One-time SSH key setup for Actions |
| `scripts/deploy-ec2.sh` | Manual deploy from laptop |
| `docker-compose.host.yml` | Production compose file used by auto-deploy |