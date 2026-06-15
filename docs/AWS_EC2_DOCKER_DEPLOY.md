# AWS EC2 Docker Deploy

> **Full production setup** (domain, Let's Encrypt, nginx, Route53): see **[AWS_PRODUCTION.md](./AWS_PRODUCTION.md)**.

This guide covers quick updates for an API-only instance already running on EC2.

## API-only production (recommended)

Logstack production on EC2 is **API-only**: Go backend + Postgres + Redis. No web dashboard container.

| Component | Hosted on EC2? | Notes |
| --------- | -------------- | ----- |
| **API** (`api.logstack.tech`) | Yes | Auth, log ingest/query, billing, alerts, mobile routes, WebSocket |
| **Web dashboard** | No | Hosted separately (e.g. Vercel) or not deployed yet |
| **Mobile app** | No | App Store / Play Store; talks to the API |
| **SDKs** (`logstack-js`, `logstack`, Go module) | No | Published to npm / PyPI / pkg.go.dev — not EC2 or CDN |
| **CDN** (CloudFront) | No | Only for Next.js static assets; irrelevant without frontend on EC2 |

**Public API base URL:** `https://api.logstack.tech/v1` (mobile, OpenAPI clients)

**SDK endpoint host:** `https://api.logstack.tech` (SDK appends `/v1/logs` itself)

Deploy / update:

```bash
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
# or from your laptop:
./scripts/deploy-ec2.sh
```

## Port map (shared EC2 host)

If other apps already use common ports, Logstack stays off them. Only the API is published to the host; Postgres and Redis are internal to the Compose network.

| Port on host | Used by (existing) | Logstack |
| ------------ | ------------------ | -------- |
| 3000 | Other app | — (web not deployed) |
| 3001 | Other app | — |
| 4000 | Other app | — |
| 4040 | Other app | — |
| 8080 | Other app | — |
| 8081 | Other app | — |
| **8082** (default) | — | **Logstack API** (`API_HOST_PORT`) |
| 5432 | — | Postgres (Docker-internal only) |
| 6379 | — | Redis (Docker-internal only) |

Set in server `.env`:

```bash
API_HOST_PORT=8082   # change if 8082 is also taken (e.g. 9080)
```

Point DNS / ALB / nginx at that host port. Example direct check:

```bash
curl http://18.225.219.208:8082/health
curl http://18.225.219.208:8082/ready
```

If you terminate TLS on nginx or an ALB, clients still use `https://api.logstack.tech/v1` while the origin targets `localhost:8082`.

It assumes:

- Your app is running on one EC2 host.
- The code lives in a working directory such as `/opt/logstack` or `~/logstack`.
- Docker and Docker Compose are already installed.
- Your production `.env` file already exists on the server.

## 1. First-time host setup

If the instance is new, SSH in and clone the repo once:

```bash
ssh ubuntu@18.225.219.208
cd ~
git clone https://github.com/Mosesedem/logstack.git logstack
cd ~/logstack
```

Copy your production env file into place and make sure secrets are real, not placeholder values:

```bash
cp /path/to/your/.env ~/logstack/.env
```

Start the API stack:

```bash
docker compose -f docker-compose.api.yml up -d --build
```

## 2. Deploying a new release

When you have already pushed code to GitHub and want the EC2 host to pick it up:

```bash
ssh ubuntu@18.225.219.208
cd ~/logstack
git pull --ff-only origin main
docker compose -f docker-compose.api.yml up -d --build --remove-orphans
```

That is the standard update flow — only the Go API image is rebuilt from source (Postgres/Redis use upstream images).

## 3. Verify the deploy

Check container health and recent logs:

```bash
docker compose -f docker-compose.api.yml ps
docker compose -f docker-compose.api.yml logs -f --tail 200 api
```

Then test the public endpoints:

```bash
# Replace 8082 with your API_HOST_PORT
curl http://18.225.219.208:8082/health
curl http://18.225.219.208:8082/ready
curl https://api.logstack.tech/v1/auth/login -X POST -H 'Content-Type: application/json' -d '{}'
```

If you front the instance with nginx or an ALB, use the public domain instead of the raw host.

## 4. Safer deploys

Before a risky change, take a database backup:

```bash
docker exec logstack-postgres pg_dump -U logstack logstack > backup.sql
```

If something looks wrong after the update, roll back by checking out the previous commit and bringing the stack back up:

```bash
git checkout PREVIOUS_COMMIT_SHA
docker compose up -d --build --remove-orphans
```

## 5. Common gotchas

- Make sure the `.env` file on the server still has the final production values.
- If the backend image fails with a message like `go.mod requires go >= 1.25.0`, rebuild with the updated backend Dockerfile. The API image now uses `golang:1.25-alpine`.
- **Port conflicts:** set `API_HOST_PORT` in `.env` (default `8082`). Check what's listening: `ss -tlnp | grep -E '8082|8080'`. The API container always uses `8080` internally; only the host binding changes.
- Postgres and Redis are not published to the host in `docker-compose.api.yml` — they cannot clash with other services on `5432`/`6379`.
- API paths are `/v1/*`, not `/api/v1/*`, unless you put nginx in front with an `/api` rewrite. SDKs and mobile expect `https://api.logstack.tech/v1`.
- `ALLOWED_ORIGINS` only matters for browser clients (CORS). Mobile and server-side SDKs do not need it.
- If database migrations were added, run them before or during the deploy window.
- If the instance uses CloudFront or nginx, clear or refresh the cache for any changed static assets.

## 6. Deploy script (recommended)

From your local machine (after pushing to `main`):

```bash
./scripts/deploy-ec2.sh
```

Options:

```bash
# Include web frontend too (unusual for this setup)
./scripts/deploy-ec2.sh --full-stack

# Take a Postgres dump before updating
./scripts/deploy-ec2.sh --backup-db

# Custom host/path
DEPLOY_HOST=ubuntu@your-ip DEPLOY_PATH=/opt/logstack ./scripts/deploy-ec2.sh
```

## 7. One-line deploy command

If you just want the shortest possible update flow, use:

```bash
ssh ubuntu@18.225.219.208 'cd ~/logstack && git pull --ff-only origin main && docker compose -f docker-compose.api.yml up -d --build --remove-orphans'
```

That is the default path for pushing a new version to an existing Docker host on AWS.
