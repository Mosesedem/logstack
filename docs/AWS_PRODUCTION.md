# AWS Production — API-only (domain + TLS)

End-to-end guide for running **only the Logstack API** on EC2 at `https://api.logstack.tech`, with Let's Encrypt TLS, Docker Compose, and a working build/deploy flow.

No web dashboard on this host. Mobile app and browser SDKs call this API directly.

---

## Architecture

```
                    Route53 A record
                         │
                         ▼
              ┌─────────────────────┐
   Internet   │  EC2 (Elastic IP)   │
   :443/:80    │  ┌───────────────┐  │
──────────────┼─►│ nginx         │  │  TLS termination (Let's Encrypt)
              │  │  :80 / :443   │  │
              │  └───────┬───────┘  │
              │          │ Docker network
              │  ┌───────▼───────┐  │
              │  │ api :8080     │  │  Go backend (not on host ports)
              │  ├───────────────┤  │
              │  │ postgres      │  │  internal only
              │  │ redis         │  │  internal only
              │  └───────────────┘  │
              └─────────────────────┘

Other apps on same host (3000, 8080, …) are untouched — Logstack only binds 80/443.
```

**Public URLs**

| Use | URL |
| --- | --- |
| Health | `https://api.logstack.tech/health` |
| API base | `https://api.logstack.tech/v1` |
| Log ingest | `POST https://api.logstack.tech/v1/logs` |
| WebSocket | `wss://api.logstack.tech/v1/stream` |
| SDK endpoint host | `https://api.logstack.tech` (SDK adds `/v1/logs`) |
| Paystack webhook | `https://api.logstack.tech/v1/webhooks/paystack` |

---

## 1. AWS prerequisites

### EC2

| Setting | Value |
| ------- | ----- |
| AMI | Ubuntu 22.04 or 24.04 LTS |
| Type | `t3.medium` or larger (4 GB+ RAM) |
| Storage | 30 GB gp3 |
| User data | Paste `infra/aws/ec2-user-data.sh` (optional bootstrap) |

### Security group (inbound)

| Port | Source | Purpose |
| ---- | ------ | ------- |
| 22 | Your IP | SSH |
| 80 | `0.0.0.0/0` | HTTP (ACME + redirect to HTTPS) |
| 443 | `0.0.0.0/0` | HTTPS API |

Do **not** expose 5432, 6379, or 8080 publicly.

### Elastic IP

1. Allocate an Elastic IP in EC2.
2. Associate it with the instance.
3. Use this IP for DNS (stable across reboots).

---

## 2. DNS (Route53 or any registrar)

Create an **A record**:

| Name | Type | Value |
| ---- | ---- | ----- |
| `api` | A | `<Elastic-IP>` |

Result: `api.logstack.tech` → your EC2 Elastic IP.

Verify before continuing:

```bash
dig +short api.logstack.tech
# must match your Elastic IP
```

---

## 3. Server setup

### SSH in and clone (if not using user-data)

```bash
ssh ubuntu@<Elastic-IP>
git clone https://github.com/Mosesedem/logstack.git ~/logstack
cd ~/logstack
```

### Production environment

```bash
cp .env.production.example .env
nano .env
```

**Required values:**

```bash
API_DOMAIN=api.logstack.tech
CERTBOT_EMAIL=you@logstack.tech
POSTGRES_PASSWORD=<strong password>
JWT_SECRET=$(openssl rand -base64 32)   # paste output
ALLOWED_ORIGINS=*
BASE_URL=https://api.logstack.tech
```

---

## 4. TLS certificate (Let's Encrypt)

DNS must already point at this host. Port 80 must be free.

```bash
chmod +x scripts/setup-ssl.sh scripts/deploy-ec2.sh scripts/renew-ssl.sh
./scripts/setup-ssl.sh
```

This script:

1. Starts temporary nginx on port 80 for the ACME webroot challenge.
2. Issues a cert via Certbot into Docker volume `logstack_certbot_conf`.
3. Prints next steps.

**Auto-renewal** (add to crontab on the server):

```bash
crontab -e
# add:
0 3 * * * cd /home/ubuntu/logstack && ./scripts/renew-ssl.sh >> /var/log/logstack-certbot.log 2>&1
```

---

## 5. Start production stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail 100 api nginx
```

### Verify

```bash
curl -fsS https://api.logstack.tech/health
curl -fsS https://api.logstack.tech/ready
```

Sign up / login (mobile or curl):

```bash
curl -X POST https://api.logstack.tech/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"SecurePass123!","name":"Test"}'
```

Ingest a log (replace key):

```bash
curl -X POST https://api.logstack.tech/v1/logs \
  -H 'Authorization: Bearer ls_live_xxx' \
  -H 'Content-Type: application/json' \
  -d '{"logs":[{"level":"info","message":"prod smoke test"}]}'
```

---

## 6. Deploy updates

### From your laptop

```bash
./scripts/deploy-ec2.sh --backup-db
```

### Auto-deploy from GitHub (push to `main`)

Workflow: `.github/workflows/deploy.yml`

1. **One-time: create deploy SSH key on EC2**

```bash
ssh ubuntu@18.225.219.208
cd ~/logstack
./scripts/setup-github-deploy.sh
```

Copy the printed **private key** into GitHub.

2. **Add repository secrets** (Settings → Secrets and variables → Actions)

| Secret | Value |
| ------ | ----- |
| `DEPLOY_KEY` | Full private key from setup script |
| `DEPLOY_HOST` | `18.225.219.208` |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_PATH` | `/home/ubuntu/logstack` |

3. **Optional:** create a `production` environment (Settings → Environments) for deploy approval gates.

4. **Trigger:** push to `main` when files change under `packages/logstack-go/`, compose files, `infra/`, or the workflow itself. Or run **Deploy API** manually from the Actions tab.

**What the workflow does:**

1. Builds the API Docker image in CI (fails fast if broken).
2. SSHs to EC2 → `git pull` → `docker compose -f docker-compose.host.yml up -d --build`.
3. Verifies `https://api.logstack.tech/health` and `/ready`.

### Manual on server

```bash
cd ~/logstack
git pull --ff-only origin main
docker compose -f docker-compose.host.yml up -d --build --remove-orphans
```

---

## 7. Compose files reference

| File | When to use |
| ---- | ----------- |
| `docker-compose.host.yml` | **Your production** — API on `127.0.0.1:8082`, host nginx + Neon + Upstash |
| `docker-compose.prod.yml` | Dedicated host — Docker nginx + bundled Postgres/Redis |
| `docker-compose.api.yml` | Direct API on host port `8082` (no TLS, debugging) |
| `docker-compose.yml` | Full stack with web frontend (not used in this setup) |

Direct-access fallback (no nginx):

```bash
docker compose -f docker-compose.api.yml up -d --build
# API on http://<ip>:8082/v1
```

---

## 8. Client configuration

### Mobile (Flutter)

```dart
static const String baseUrl = 'https://api.logstack.tech/v1';
```

### Browser SDK (after npm publish)

```html
<script type="module">
  import { createLogStack } from "https://esm.sh/logstack-js";
  const logstack = createLogStack({ apiKey: "ls_live_xxx" });
  logstack.info("loaded");
</script>
```

### Paystack dashboard

Webhook URL: `https://api.logstack.tech/v1/webhooks/paystack`

---

## 9. Troubleshooting

| Symptom | Fix |
| ------- | --- |
| nginx won't start | Run `./scripts/setup-ssl.sh` first; certs must exist in `logstack_certbot_conf` |
| `502 Bad Gateway` | `docker compose -f docker-compose.prod.yml logs api` — wait for healthcheck |
| Certbot fails | DNS not propagated, or port 80 blocked/in use |
| CORS errors in browser | Set `ALLOWED_ORIGINS` in `.env`, rebuild api: `docker compose -f docker-compose.prod.yml up -d --build api` |
| Port 80 conflict | Stop other service on 80, or use ALB for TLS instead of host nginx |

### Database backup

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U logstack logstack > backup.sql
```

### Rollback

```bash
git checkout <previous-sha>
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 10. Production checklist

- [ ] Elastic IP allocated and associated
- [ ] `api.logstack.tech` A record → Elastic IP
- [ ] Security group: 22, 80, 443 only
- [ ] `.env` filled with strong `JWT_SECRET` + `POSTGRES_PASSWORD`
- [ ] `./scripts/setup-ssl.sh` succeeded
- [ ] `docker compose -f docker-compose.prod.yml up -d --build` healthy
- [ ] `https://api.logstack.tech/health` returns OK
- [ ] Signup + project create + API key + log ingest smoke test
- [ ] Certbot cron renewal configured
- [ ] Paystack webhook URL set (if using billing)
- [ ] Mobile `baseUrl` points at `https://api.logstack.tech/v1`