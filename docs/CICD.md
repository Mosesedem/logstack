# CI/CD — Complete Guide

End-to-end continuous integration and deployment for Logstack:

| Component | Host | Deploy method |
| --------- | ---- | ------------- |
| **API** (`api.logstack.tech`) | AWS EC2 + Docker | GitHub Actions → SSH → `docker compose` |
| **Web** (`www.logstack.tech`) | Vercel (recommended) | Vercel Git integration (auto on push) |
| **JS SDK** (`logstack-js`) | npm | GitHub Actions on version tag |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub (main branch)                      │
└───────────────────────────────┬─────────────────────────────────┘
                                │
            ┌───────────────────┴───────────────────┐
            ▼                                       ▼
   .github/workflows/ci.yml              .github/workflows/deploy.yml
   (every push + PR)                     (after CI passes on main)
            │                                       │
            ├─ go test / vet                      ├─ path filter (API files only)
            ├─ Docker build gate                  ├─ SSH to EC2
            ├─ pnpm lint + build (web)            ├─ git pull
            └─ build logstack-js                  └─ docker compose up --build
                                                        └─ health checks
```

**Key behaviour:**

- **CI always runs** on pushes and PRs to `main`.
- **Deploy only runs after CI succeeds** on `main` (via `workflow_run`).
- **Deploy is skipped** when the commit only touches web, docs, or mobile — no unnecessary API rebuilds.
- **Manual deploy** is always available from Actions → **Deploy API** → **Run workflow**.

---

## Prerequisites

Before enabling auto-deploy, the production API must already be healthy:

| Check | Command / URL |
| ----- | ------------- |
| EC2 reachable via SSH | `ssh ubuntu@<elastic-ip>` |
| Repo cloned | `/home/ubuntu/logstack` |
| `.env` configured | `POSTGRES_PASSWORD`, `JWT_SECRET`, `ALLOWED_ORIGINS`, etc. |
| API healthy locally | `curl http://127.0.0.1:8082/health` |
| API healthy publicly | `curl https://api.logstack.tech/health` |

First-time server setup: [AWS_PRODUCTION.md](./AWS_PRODUCTION.md).

---

## One-time setup (API auto-deploy)

### Step 1 — SSH deploy key on EC2

SSH into the server and run the setup script:

```bash
ssh ubuntu@18.225.219.208
cd ~/logstack
git pull --ff-only origin main
./scripts/setup-github-deploy.sh
```

The script:

1. Creates `~/.ssh/logstack_github_deploy` (ed25519 key pair)
2. Adds the public key to `~/.ssh/authorized_keys`
3. Verifies Docker, git, and `.env` exist
4. Prints the values for GitHub secrets

> **Never commit the private key.** Paste it only into GitHub Actions secrets.

### Step 2 — GitHub repository secrets

GitHub → **Repository → Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value | Example |
| ------ | ----- | ------- |
| `DEPLOY_KEY` | Full private key (`-----BEGIN OPENSSH PRIVATE KEY-----` …) | From setup script output |
| `DEPLOY_HOST` | EC2 public IP or hostname | `18.225.219.208` |
| `DEPLOY_USER` | SSH user | `ubuntu` |
| `DEPLOY_PATH` | Repo path on server | `/home/ubuntu/logstack` |

Retrieve the private key again if needed:

```bash
ssh ubuntu@18.225.219.208 'cat ~/.ssh/logstack_github_deploy'
```

### Step 3 — (Optional) Production environment gate

The deploy job uses `environment: production`. In GitHub:

**Settings → Environments → New environment → `production`**

- Add **Required reviewers** if you want manual approval before each deploy.
- Or remove `environment: production` from `.github/workflows/deploy.yml` for immediate deploys.

### Step 4 — Verify auto-deploy

**Option A — push a small API change:**

```bash
# e.g. add a comment in packages/logstack-go/cmd/server/main.go
git push origin main
```

**Option B — manual workflow:**

GitHub → **Actions** → **Deploy API** → **Run workflow**

Watch both workflows:

1. **CI** — must finish green
2. **Deploy API** — starts after CI; deploy job should pass health checks

---

## Workflows reference

### CI (`.github/workflows/ci.yml`)

**Triggers:** push to `main`, PRs to `main`, manual `workflow_dispatch`

**Steps:**

1. `pnpm install --frozen-lockfile`
2. Go: `go vet`, `go test`, binary build
3. Docker: build API image (fail-fast gate)
4. Build `logstack-js`
5. Lint + build `@logstack/web`

PRs run the same checks but **do not deploy**.

### Deploy API (`.github/workflows/deploy.yml`)

**Triggers:**

- `workflow_run` after **CI** completes successfully on `main`
- Manual `workflow_dispatch`

**Path filter** (automatic deploys only — manual always deploys):

| Path | Reason |
| ---- | ------ |
| `packages/logstack-go/**` | Go API source |
| `docker-compose.host.yml` | Production compose |
| `docker-compose.prod.yml` | Alternate prod compose |
| `docker-compose.api.yml` | Direct-access compose |
| `infra/**` | Nginx / AWS configs |
| `scripts/deploy-ec2.sh`, `scripts/remote-deploy.sh` | Deploy scripts |
| `.github/workflows/deploy.yml` | Workflow itself |

**Deploy steps:**

1. Validate `DEPLOY_*` secrets exist
2. SCP `scripts/remote-deploy.sh` to the server
3. SSH and run the script
4. Health checks:
   - `http://127.0.0.1:<API_HOST_PORT>/health` (local, required)
   - `https://api.logstack.tech/health` + `/ready` (public, required by default)

**Manual workflow inputs:**

| Input | Default | Description |
| ----- | ------- | ----------- |
| `git_ref` | `main` | Branch or tag to deploy |
| `require_https` | `true` | Fail if public HTTPS health check fails |

---

## Server `.env` checklist

Copy `.env.production.example` → `.env` on the server. Minimum required:

```bash
POSTGRES_PASSWORD=<strong-password>
JWT_SECRET=<openssl rand -base64 32>
DATABASE_URL=postgres://logstack:<password>@postgres:5432/logstack?sslmode=disable
REDIS_URL=redis://redis:6379
ENV=production
BASE_URL=https://api.logstack.tech
ALLOWED_ORIGINS=https://logstack.tech,https://www.logstack.tech
API_HOST_PORT=8082
```

The backend auto-pairs apex ↔ www origins, but listing both explicitly is still recommended.

After editing `.env`:

```bash
docker compose -f docker-compose.host.yml up -d --build api
```

---

## Manual deploy (without GitHub)

### From your laptop

```bash
./scripts/deploy-ec2.sh
./scripts/deploy-ec2.sh --backup-db   # pg_dump first
```

Custom host:

```bash
DEPLOY_HOST=ubuntu@your-ip DEPLOY_PATH=/home/ubuntu/logstack ./scripts/deploy-ec2.sh
```

### Directly on the server

```bash
cd ~/logstack
git pull --ff-only origin main
./scripts/remote-deploy.sh
```

---

## Web dashboard deploy (`www.logstack.tech`)

The production web app is **not** deployed by the EC2 workflow. Host it on **Vercel** (or similar) with Git integration:

### Vercel setup

1. [vercel.com](https://vercel.com) → **Add New Project** → import `Mosesedem/logstack`
2. **Root Directory:** `apps/web`
3. **Framework Preset:** Next.js
4. **Build Command:** `cd ../.. && pnpm install && pnpm --filter @logstack/web build`
   - Or set Vercel root to monorepo root and use `pnpm --filter @logstack/web build`
5. **Environment variables** (Production):

| Variable | Value |
| -------- | ----- |
| `NEXT_PUBLIC_API_URL` | `https://api.logstack.tech/v1` |
| `NEXT_PUBLIC_WS_URL` | `wss://api.logstack.tech/v1/stream` |
| `NEXTAUTH_URL` | `https://www.logstack.tech` |
| `NEXTAUTH_SECRET` | `<openssl rand -base64 32>` |
| `NEXT_PUBLIC_LOGSTACK_API_KEY` | Your dashboard project API key (optional) |

6. **Domains:** add `www.logstack.tech` and `logstack.tech` (redirect apex → www)
7. Enable **Auto-deploy** on push to `main`

Vercel rebuilds the dashboard on every push to `main` that touches `apps/web/` — independent of the API deploy workflow.

---

## JS SDK publish (`logstack-js`)

Workflow: `.github/workflows/publish-js.yml`

**Triggers:**

- Git tag `logstack-js-v*` (e.g. `logstack-js-v1.2.0`)
- Manual `workflow_dispatch`

**Required secret:** `NPM_TOKEN` (npm automation token with publish access)

1. npmjs.com → **Access Tokens** → **Generate New Token** (Granular: package `logstack-js`, permission **Read and write**, or Classic **Automation**).
2. GitHub repo → **Settings → Secrets and variables → Actions** → **New repository secret** → name `NPM_TOKEN`, paste the `npm_...` token.

**Release steps** (version in `package.json` must match the tag):

```bash
# 1. Commit the version bump first (package.json, src/index.ts VERSION, dist after build)
cd packages/logstack-js && pnpm build && pnpm test
git add packages/logstack-js && git commit -m "chore(js-sdk): release logstack-js v1.0.2"

# 2. Tag the commit that contains the bump (delete old tag if you tagged too early)
git tag -d logstack-js-v1.0.2
git push origin :refs/tags/logstack-js-v1.0.2   # delete remote tag
git tag logstack-js-v1.0.2
git push origin logstack-js-v1.0.2
```

The workflow fails fast if `NPM_TOKEN` is missing or if the tag version ≠ `package.json` version.

**Manual fallback** (if you prefer not to use CI):

```bash
cd packages/logstack-js
npm login   # or: export NODE_AUTH_TOKEN=npm_...
pnpm build && pnpm test
npm publish --access public
```

---

## Troubleshooting

### Deploy workflow never runs after push

| Cause | Fix |
| ----- | --- |
| CI failed | Fix failing tests in Actions → CI |
| Push didn't touch API paths | Expected — use manual **Deploy API** or change an API file |
| `workflow_run` delay | Wait 1–2 minutes after CI completes |

### "Missing DEPLOY_KEY, DEPLOY_HOST, or DEPLOY_USER"

Repository secrets not configured. Complete [Step 2](#step-2--github-repository-secrets).

### "Permission denied (publickey)"

- `DEPLOY_KEY` truncated or wrong — must include full BEGIN/END block
- Re-run `./scripts/setup-github-deploy.sh` on the server

### "Missing .env on server"

```bash
ssh ubuntu@18.225.219.208
cp ~/logstack/.env.production.example ~/logstack/.env
nano ~/logstack/.env   # fill secrets
```

### Local health OK, HTTPS health fails

```bash
ssh ubuntu@18.225.219.208
docker compose -f ~/logstack/docker-compose.host.yml ps
curl http://127.0.0.1:8082/health
sudo nginx -t && sudo systemctl status nginx
curl -I https://api.logstack.tech/health
```

Common causes:

- Host nginx not proxying to `127.0.0.1:8082` — run `./scripts/setup-host-nginx.sh`
- TLS not issued — `sudo certbot --nginx -d api.logstack.tech`
- Cloudflare SSL mode mismatch — use **Full** or **Full (strict)**
- API container crash-loop — `docker compose logs --tail 100 api`

### Browser CORS errors on dashboard

Usually one of:

1. **API down** (502 from Cloudflare) — browser reports as CORS; fix API first
2. **`ALLOWED_ORIGINS` missing `www`** — set both apex and www in server `.env`, redeploy

### `git pull` fails on server during deploy

Public repo: ensure outbound HTTPS to GitHub works.

Private repo: add a read-only deploy key to the GitHub repo (Settings → Deploy keys) and configure git on the server to use it.

### CI fails: Go version mismatch

CI uses Go **1.25** (matches `go.mod`). If you see version errors locally, upgrade Go.

### Emergency deploy (skip HTTPS check)

Actions → **Deploy API** → **Run workflow** → set `require_https` to `false`.

Use only when local health passes but Cloudflare/nginx is temporarily misconfigured.

---

## Security notes

- Use a **dedicated deploy key** (`logstack_github_deploy`), not your personal SSH key
- Restrict EC2 security group: port 22 from trusted IPs where possible
- Never commit `.env`, `DEPLOY_KEY`, or `JWT_SECRET`
- The workflow deletes `~/.ssh/deploy_key` on the runner after each job
- Set `ALLOWED_ORIGINS` to your real domains — never `*` in production

---

## Quick reference

| Task | Command / location |
| ---- | ------------------ |
| View CI status | GitHub → Actions → **CI** |
| Manual API deploy | Actions → **Deploy API** → Run workflow |
| Manual deploy from laptop | `./scripts/deploy-ec2.sh` |
| Server-side deploy | `./scripts/remote-deploy.sh` |
| One-time SSH key setup | `./scripts/setup-github-deploy.sh` |
| Production bootstrap | [AWS_PRODUCTION.md](./AWS_PRODUCTION.md) |
| Quick EC2 update | [AWS_EC2_DOCKER_DEPLOY.md](./AWS_EC2_DOCKER_DEPLOY.md) |

---

## Related files

| File | Purpose |
| ---- | ------- |
| `.github/workflows/ci.yml` | Lint, test, build gate |
| `.github/workflows/deploy.yml` | Auto-deploy API to EC2 |
| `.github/workflows/publish-js.yml` | Publish JS SDK to npm |
| `scripts/remote-deploy.sh` | Server-side deploy logic |
| `scripts/deploy-ec2.sh` | Manual deploy from laptop |
| `scripts/setup-github-deploy.sh` | One-time GitHub Actions SSH setup |
| `docker-compose.host.yml` | Production API stack |
| `.env.production.example` | Server `.env` template |