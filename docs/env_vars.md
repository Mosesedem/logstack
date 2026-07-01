# Environment Variables Reference

Complete reference for every secret, API key, and configuration variable needed to run Logstack locally or in production. Copy `.env.example` to `.env` at the repo root and fill in values.

---

## Quick start (minimum viable local stack)

| Variable | Where | Required |
|----------|-------|----------|
| `DATABASE_URL` | API | Yes |
| `REDIS_URL` | API | Yes |
| `JWT_SECRET` | API | Yes |
| `BASE_URL` | API | Yes |
| `NEXT_PUBLIC_API_URL` | Web | Yes |
| `NEXTAUTH_SECRET` | Web | Yes |
| `NEXTAUTH_URL` | Web | Yes |

Email, push, billing, and OAuth are optional for local dev. Without an email provider, signup still works but verification emails fail silently (logged server-side).

---

## Database & cache

### `DATABASE_URL`
- **Used by:** Go API (`packages/logstack-go`)
- **Format:** `postgresql://USER:PASS@HOST:PORT/DB?sslmode=require`
- **Where to get it:**
  - Local: `docker compose -f docker-compose.dev.yml up -d` → `postgres://logstack:logstack@localhost:5432/logstack`
  - Neon: [console.neon.tech](https://console.neon.tech) → Connection string (use pooled endpoint)

### `DB_MAX_IDLE_CONNS`, `DB_MAX_OPEN_CONNS`, `DB_CONN_MAX_LIFE`
- Connection pool tuning. Defaults are fine for local dev.

### `REDIS_URL`
- **Used by:** API (rate limits, pub/sub streaming, alert cooldowns, usage metering)
- **Format:** `redis://host:6379` or `rediss://` for TLS (Upstash)
- **Where to get it:**
  - Local: `redis://localhost:6379` via `docker-compose.dev.yml`
  - Upstash: [console.upstash.com](https://console.upstash.com) → Redis → REST/URL tab

### `REDIS_POOL_SIZE`
- Redis connection pool size. Default `10`.

---

## Authentication (JWT)

### `JWT_SECRET`
- **Used by:** API — signs access and refresh tokens
- **Generate:** `openssl rand -base64 32`
- **Where:** You create this; never commit the production value

### `ACCESS_TOKEN_EXPIRY` / `REFRESH_TOKEN_EXPIRY`
- Go duration strings (`15m`, `168h`). Control session lifetime.

### `NEXTAUTH_SECRET`
- **Used by:** Web dashboard (`apps/web`) — NextAuth.js session encryption
- **Generate:** `openssl rand -base64 32`

### `NEXTAUTH_URL`
- **Used by:** Web — full public URL of the dashboard
- **Examples:** `http://localhost:3000` (dev), `https://logstack.tech` (prod)
- **Required for:** OAuth callbacks, email verification links that redirect to the web app

### `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- **Used by:** Web OAuth login
- **Where:** [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client ID
- **Redirect URI:** `{NEXTAUTH_URL}/api/auth/callback/google`

### `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
- **Used by:** Web OAuth login
- **Where:** [GitHub Developer Settings](https://github.com/settings/developers) → OAuth Apps
- **Callback URL:** `{NEXTAUTH_URL}/api/auth/callback/github`

---

## Email notifications (transactional)

The API uses an **API provider chain** (not raw SMTP). First configured provider wins:

**Mailcow → Brevo → Resend → Zoho**

At least one provider must be configured for email to work.

### `MAILCOW_API_KEY` + `MAILCOW_API_URL`
- **Used by:** API email (primary provider)
- **Where:** Your Mailcow admin → API → Read/Write key; URL is your mail host (e.g. `https://mail.example.com`)

### `BREVO_API_KEY`
- **Used by:** API email (fallback)
- **Where:** [Brevo API keys](https://app.brevo.com/settings/keys/api)
- **Format:** `xkeysib-...`

### `RESEND_API_KEY`
- **Used by:** API email (fallback)
- **Where:** [Resend API keys](https://resend.com/api-keys)
- **Format:** `re_...`

### `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_REFRESH_TOKEN`
- **Used by:** API email (final fallback)
- **Where:** [Zoho API Console](https://api-console.zoho.com/) with `ZohoMail.messages.CREATE` scope

### `BASE_URL`
- **Used by:** API — links in verification, password reset, org invite, and billing emails
- **Must match** the public web dashboard URL users click from email
- **Example:** `https://logstack.tech` or `http://localhost:3000`
- **Validated at API startup** (required)

### `FRONTEND_URL`
- **Used by:** API QR mobile-login links only (`/link-mobile`)
- **Defaults to:** `http://localhost:3000` if unset
- Set when `BASE_URL` and the QR landing page differ

**Email flows wired when providers + `BASE_URL` are set:**
- Signup verification (`POST /v1/auth/signup` → email with verify link)
- Resend verification (`POST /v1/auth/resend-verification`)
- Password reset (`POST /v1/auth/forgot-password`)
- Org invites (`POST /v1/organizations/:id/invites`)
- Log alert emails (alert rules with `email` channel)
- Usage warnings at 80%, 90%, 100%

---

## Push notifications (FCM)

### `FCM_SERVICE_ACCOUNT_PATH`
- **Used by:** API — Firebase Admin SDK (HTTP v1 API)
- **Where:**
  1. [Firebase Console](https://console.firebase.google.com/) → Project Settings → Service accounts
  2. Generate new private key → save JSON securely
  3. Point this env var at the file path (e.g. `./secrets/firebase-service-account.json`)
- **Leave empty** to disable push delivery (mobile token registration still works)

### `FCM_PROJECT_ID`
- **Used by:** API FCM client
- **Where:** Firebase Console → Project Settings → General → Project ID
- Optional if inferable from the service account JSON

**Mobile app** uses its own Firebase config (`google-services.json`, `GoogleService-Info.plist`, `firebase_options.dart`) — separate from the API service account.

---

## Web dashboard

### `NEXT_PUBLIC_API_URL`
- **Used by:** Web browser → API calls
- **Format:** Must end in `/v1` (e.g. `http://localhost:8080/v1`)
- **Do not** double-prefix paths — client methods are relative to `/v1`

### `NEXT_PUBLIC_WS_URL`
- **Used by:** Web real-time log stream
- **Format:** `ws://localhost:8080/v1/stream` (dev) or `wss://api.logstack.tech/v1/stream` (prod)

### `NEXT_PUBLIC_LOGSTACK_API_KEY`
- **Used by:** Web app's internal logger (`apps/web/src/lib/logger.ts`)
- **Where:** Dashboard → Projects → create project → copy API key
- **Without it:** Console logging still works (`disabled: true`); logs are not shipped
- **Optional** for local dashboard dev

---

## SDK / log ingestion (user applications)

Users configure these in **their own apps**, not in the Logstack `.env`:

| Variable | SDK | Purpose |
|----------|-----|---------|
| `LOGSTACK_API_KEY` | JS/Python/Go | Project API key from dashboard |
| `LOGSTACK_ENDPOINT` / `api_url` / `APIURL` | All | API host, default `https://api.logstack.tech` |
| `NODE_ENV` | JS | Auto-detects `environment` (dev = console on, prod = console off by default) |

**Ingest endpoint (all SDKs):** `POST {endpoint}/v1/logs` with `Authorization: Bearer {apiKey}`

**Console behavior (JS SDK):**
- `development`/`test`: console on by default; **still ships** if `apiKey` set and not `disabled`
- `production`/`staging`: console off by default; ships to server
- `disabled: true`: console-only, never ships (use when no API key locally)

---

## Billing

### Paystack (Nigeria / NGN)
- **`PAYSTACK_SECRET_KEY`** — [Paystack Developer Settings](https://dashboard.paystack.com/#/settings/developer)
- **`PAYSTACK_PUBLIC_KEY`** — same page (client-side checkout)
- **`PAYSTACK_WEBHOOK_URL`** — your API webhook endpoint

### Polar (International / USD)
- **`POLAR_ACCESS_TOKEN`** — [Polar Dashboard](https://polar.sh/dashboard)
- **`POLAR_WEBHOOK_SECRET`** — Polar webhook signing secret
- **`POLAR_PRODUCT_STARTER`** / **`POLAR_PRODUCT_PRO`** — product UUIDs from Polar

---

## Server & operations

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8080` | API listen port (inside container) |
| `API_HOST_PORT` | `8082` | Host port mapped in Docker Compose |
| `ENV` | `development` | `development` or `production` |
| `ALLOWED_ORIGINS` | — | Comma-separated CORS origins (never `*` in prod) |
| `RATE_LIMIT_REQUESTS` | `100` | Requests per window per IP |
| `RATE_LIMIT_WINDOW` | `1m` | Rate limit window |
| `LOG_LEVEL` | `info` | API slog level |
| `LOG_JSON` | `false` | JSON logs for production aggregation |
| `USAGE_SYNC_INTERVAL` | `1m` | Usage metering sync interval |

---

## Security checklist (production)

1. Generate unique `JWT_SECRET` and `NEXTAUTH_SECRET`
2. Set `BASE_URL` and `NEXTAUTH_URL` to your real domain
3. Configure at least one email provider
4. Mount Firebase service account JSON for push; never commit it
5. Add `secrets/` and `*.json` (except package manifests) to `.gitignore`
6. Set `ALLOWED_ORIGINS` to your actual frontend origins
7. Use `sslmode=require` on `DATABASE_URL`
8. Use `rediss://` for managed Redis with TLS

---

## Verification commands

```bash
# API health
curl http://localhost:8080/health

# Ingest test (replace key)
curl -X POST http://localhost:8080/v1/logs \
  -H "Authorization: Bearer ls_..." \
  -H "Content-Type: application/json" \
  -d '{"logs":[{"level":"info","message":"hello from curl"}]}'

# Email provider configured?
# Check API startup logs for email provider chain initialization

# FCM configured?
# Check API startup logs for "push notifier enabled" or "push notifier disabled"
```