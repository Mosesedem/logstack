# Environment Variables Reference

Complete reference for every secret, API key, and configuration variable needed to run Logstack locally or in production. Copy `.env.example` to `.env` at the repo root and fill in values.

### Where values apply

| Label            | Meaning                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **API**          | Go backend (`packages/logstack-go`) — read from repo-root `.env` at startup                                              |
| **Web**          | Next.js dashboard (`apps/web`) — browser/client code (`NEXT_PUBLIC_*`)                                                   |
| **Web (server)** | Next.js server-only routes (NextAuth, API route handlers) — never exposed to the browser                                 |
| **SDK**          | End-user applications using `logstack-js`, `logstack-py`, or `logstack-go-sdk` — **not** in the Logstack monorepo `.env` |
| **Docker**       | Docker Compose / deployment scripts only — not read by application code                                                  |

### Required vs optional

| Label                        | Meaning                                                         |
| ---------------------------- | --------------------------------------------------------------- |
| **Required**                 | Must be set or the API will not start / auth will break         |
| **Required (prod)**          | Enforced only when `ENV=production`                             |
| **Optional**                 | Has a default or the feature degrades gracefully when unset     |
| **Required for \<feature\>** | Optional globally, but needed for that specific feature to work |

---

## Quick start (minimum viable local stack)

| Variable              | Where        | Required                                       |
| --------------------- | ------------ | ---------------------------------------------- |
| `DATABASE_URL`        | API          | Required                                       |
| `REDIS_URL`           | API          | Required                                       |
| `JWT_SECRET`          | API          | Required                                       |
| `PORT`                | API          | Required                                       |
| `ENV`                 | API          | Required                                       |
| `BASE_URL`            | API          | Required                                       |
| `NEXT_PUBLIC_API_URL` | Web          | Required                                       |
| `NEXTAUTH_SECRET`     | Web (server) | Required                                       |
| `NEXTAUTH_URL`        | Web (server) | Required                                       |
| `API_URL`             | Web (server) | Optional (defaults to `http://localhost:8080`) |

Email, push, billing, and OAuth are optional for local dev. Without an email provider, signup still works but verification emails fail silently (logged server-side).

---

## Master reference

| Variable                         | Where          | Required                 | Default (if unset)                                |
| -------------------------------- | -------------- | ------------------------ | ------------------------------------------------- |
| `DATABASE_URL`                   | API            | Required                 | —                                                 |
| `DB_MAX_IDLE_CONNS`              | API            | Optional                 | loaded in config; not yet applied by `cmd/server` |
| `DB_MAX_OPEN_CONNS`              | API            | Optional                 | loaded in config; not yet applied by `cmd/server` |
| `DB_CONN_MAX_LIFE`               | API            | Optional                 | loaded in config; not yet applied by `cmd/server` |
| `REDIS_URL`                      | API            | Required                 | —                                                 |
| `REDIS_POOL_SIZE`                | API            | Optional                 | Redis client default                              |
| `JWT_SECRET`                     | API            | Required                 | —                                                 |
| `ACCESS_TOKEN_EXPIRY`            | API            | Optional                 | `0` (set `15m` in `.env.example`)                 |
| `REFRESH_TOKEN_EXPIRY`           | API            | Optional                 | `0` (set `168h` in `.env.example`)                |
| `ADMIN_EMAILS`                   | API            | Optional                 | `mosesedem81@gmail.com`                           |
| `ADMIN_SEED_PASSWORD`            | API            | Optional                 | random password logged once if admin user created |
| `MAILCOW_API_KEY`                | API            | Optional                 | —                                                 |
| `MAILCOW_API_URL`                | API            | Optional                 | —                                                 |
| `BREVO_API_KEY`                  | API            | Optional                 | —                                                 |
| `RESEND_API_KEY`                 | API            | Optional                 | —                                                 |
| `ZOHO_CLIENT_ID`                 | API            | Optional                 | —                                                 |
| `ZOHO_CLIENT_SECRET`             | API            | Optional                 | —                                                 |
| `ZOHO_REFRESH_TOKEN`             | API            | Optional                 | —                                                 |
| `BASE_URL`                       | API            | Required                 | —                                                 |
| `FRONTEND_URL`                   | API            | Optional                 | `http://localhost:3000`                           |
| `FCM_SERVICE_ACCOUNT_PATH`       | API            | Optional                 | — (push disabled)                                 |
| `FCM_PROJECT_ID`                 | API            | Optional                 | inferred from service account JSON                |
| `NEXT_PUBLIC_API_URL`            | Web            | Required                 | `http://localhost:8080/v1` (code fallback)        |
| `NEXT_PUBLIC_WS_URL`             | Web            | Optional                 | `ws://localhost:8080/v1`                          |
| `NEXT_PUBLIC_LOGSTACK_API_KEY`   | Web            | Optional                 | — (console-only logging)                          |
| `API_URL`                        | Web (server)   | Optional                 | `http://localhost:8080`                           |
| `NEXTAUTH_SECRET`                | Web (server)   | Required                 | —                                                 |
| `NEXTAUTH_URL`                   | Web (server)   | Required                 | —                                                 |
| `GOOGLE_CLIENT_ID`               | Web (server)   | Optional                 | — (Google OAuth disabled)                         |
| `GOOGLE_CLIENT_SECRET`           | Web (server)   | Optional                 | —                                                 |
| `GITHUB_CLIENT_ID`               | Web (server)   | Optional                 | — (GitHub OAuth disabled)                         |
| `GITHUB_CLIENT_SECRET`           | Web (server)   | Optional                 | —                                                 |
| `NODE_ENV`                       | Web / SDK (JS) | Optional                 | `development` (Next.js)                           |
| `PAYSTACK_SECRET_KEY`            | API            | Optional                 | — (Paystack billing disabled)                     |
| `PAYSTACK_PUBLIC_KEY`            | API            | Optional                 | —                                                 |
| `PAYSTACK_WEBHOOK_URL`           | API            | Optional                 | —                                                 |
| `POLAR_ACCESS_TOKEN`             | API            | Optional                 | — (Polar billing disabled)                        |
| `POLAR_WEBHOOK_SECRET`           | API            | Optional                 | —                                                 |
| `POLAR_PRODUCT_STARTER`          | API            | Optional                 | —                                                 |
| `POLAR_PRODUCT_PRO`              | API            | Optional                 | —                                                 |
| `PORT`                           | API            | Required                 | — (`.env.example`: `8080`)                        |
| `API_HOST_PORT`                  | Docker         | Optional                 | `8082`                                            |
| `ENV`                            | API            | Required                 | — (`.env.example`: `development`)                 |
| `ALLOWED_ORIGINS`                | API            | Optional                 | empty (CORS blocks browsers)                      |
| `READ_TIMEOUT`                   | API            | Optional                 | loaded in config; not yet applied by `cmd/server` |
| `WRITE_TIMEOUT`                  | API            | Optional                 | loaded in config; not yet applied by `cmd/server` |
| `IDLE_TIMEOUT`                   | API            | Optional                 | loaded in config; not yet applied by `cmd/server` |
| `RATE_LIMIT_REQUESTS`            | API            | Optional                 | `0` (`.env.example`: `100`)                       |
| `RATE_LIMIT_WINDOW`              | API            | Optional                 | `0` (`.env.example`: `1m`)                        |
| `LOG_LEVEL`                      | API            | Optional                 | `info`                                            |
| `LOG_JSON`                       | API            | Optional                 | `false`                                           |
| `USAGE_SYNC_INTERVAL`            | API            | Optional                 | `1m`                                              |
| `POSTGRES_USER`                  | Docker         | Optional                 | `logstack`                                        |
| `POSTGRES_PASSWORD`              | Docker         | Required for Docker prod | —                                                 |
| `POSTGRES_DB`                    | Docker         | Optional                 | `logstack`                                        |
| `apiKey` / `LOGSTACK_API_KEY`    | SDK            | Required for ingest      | —                                                 |
| `endpoint` / `LOGSTACK_ENDPOINT` | SDK (JS)       | Optional                 | `https://api.logstack.tech`                       |
| `api_url`                        | SDK (Python)   | Optional                 | `https://api.logstack.tech`                       |
| `APIURL`                         | SDK (Go)       | Optional                 | `https://api.logstack.tech`                       |

---

## Database & cache

### `DATABASE_URL`

- **Where:** API
- **Required:** Yes
- **Format:** `postgresql://USER:PASS@HOST:PORT/DB?sslmode=require`
- **Where to get it:**
  - Local: `docker compose -f docker-compose.dev.yml up -d` → `postgres://logstack:logstack@localhost:5432/logstack`
  - Neon: [console.neon.tech](https://console.neon.tech) → Connection string (use pooled endpoint)

### `DB_MAX_IDLE_CONNS`, `DB_MAX_OPEN_CONNS`, `DB_CONN_MAX_LIFE`

- **Where:** API
- **Required:** No — connection pool tuning (`.env.example`: `10` / `100` / `30m`)
- **Note:** Loaded into config; `cmd/server` does not yet pass these to the DB pool

### `REDIS_URL`

- **Where:** API
- **Required:** Yes
- **Format:** `redis://host:6379` or `rediss://` for TLS (Upstash)
- **Where to get it:**
  - Local: `redis://localhost:6379` via `docker-compose.dev.yml`
  - Upstash: [console.upstash.com](https://console.upstash.com) → Redis → REST/URL tab

### `REDIS_POOL_SIZE`

- **Where:** API
- **Required:** No — Redis connection pool size; default `10` in `.env.example`

---

## Authentication (JWT)

### `JWT_SECRET`

- **Where:** API
- **Required:** Yes (≥ 32 characters when `ENV=production`)
- **Generate:** `openssl rand -base64 32`

### `ACCESS_TOKEN_EXPIRY` / `REFRESH_TOKEN_EXPIRY`

- **Where:** API
- **Required:** No — Go duration strings (`15m`, `168h`); control session lifetime

### `NEXTAUTH_SECRET`

- **Where:** Web (server)
- **Required:** Yes — NextAuth.js session encryption
- **Generate:** `openssl rand -base64 32`

### `NEXTAUTH_URL`

- **Where:** Web (server)
- **Required:** Yes — full public URL of the dashboard
- **Examples:** `http://localhost:3000` (dev), `https://logstack.tech` (prod)
- **Required for:** OAuth callbacks, email verification links that redirect to the web app

### `API_URL`

- **Where:** Web (server)
- **Required:** No — server-side base URL for NextAuth → API calls (`/v1/auth/login`, `/v1/auth/refresh`, `/v1/auth/oauth`)
- **Default:** `http://localhost:8080` (no `/v1` suffix; routes append it)
- **Note:** Separate from `NEXT_PUBLIC_API_URL`, which is used by browser-side code and must end in `/v1`

### `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

- **Where:** Web (server)
- **Required:** No — enable Google OAuth login
- **Where:** [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client ID
- **Redirect URI:** `{NEXTAUTH_URL}/api/auth/callback/google`

### `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`

- **Where:** Web (server)
- **Required:** No — enable GitHub OAuth login
- **Where:** [GitHub Developer Settings](https://github.com/settings/developers) → OAuth Apps
- **Callback URL:** `{NEXTAUTH_URL}/api/auth/callback/github`

---

## Email notifications (transactional)

The API uses an **API provider chain** (not raw SMTP). First configured provider wins:

**Mailcow → Brevo → Resend → Zoho**

At least one provider must be configured for email to work.

### `MAILCOW_API_KEY` + `MAILCOW_API_URL`

- **Where:** API
- **Required:** No — primary email provider (both must be set for Mailcow to activate)
- **Where:** Your Mailcow admin → API → Read/Write key; URL is your mail host (e.g. `https://mail.example.com`)

### `BREVO_API_KEY`

- **Where:** API
- **Required:** No — first cloud fallback
- **Where:** [Brevo API keys](https://app.brevo.com/settings/keys/api)
- **Format:** `xkeysib-...`

### `RESEND_API_KEY`

- **Where:** API
- **Required:** No — second cloud fallback
- **Where:** [Resend API keys](https://resend.com/api-keys)
- **Format:** `re_...`

### `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_REFRESH_TOKEN`

- **Where:** API
- **Required:** No — final fallback (all three must be set for Zoho to activate)
- **Where:** [Zoho API Console](https://api-console.zoho.com/) with `ZohoMail.messages.CREATE` scope

### `BASE_URL`

- **Where:** API
- **Required:** Yes — links in verification, password reset, org invite, and billing emails
- **Must match** the public web dashboard URL users click from email
- **Example:** `https://logstack.tech` or `http://localhost:3000`
- **Validated at API startup**

### `FRONTEND_URL`

- **Where:** API
- **Required:** No — QR mobile-login links only (`/link-mobile`)
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

- **Where:** API
- **Required:** No — leave empty to disable push delivery (mobile token registration still works)
- **Where:**
  1. [Firebase Console](https://console.firebase.google.com/) → Project Settings → Service accounts
  2. Generate new private key → save JSON securely
  3. Point this env var at the file path (e.g. `./secrets/firebase-service-account.json`)

### `FCM_PROJECT_ID`

- **Where:** API
- **Required:** No — optional if inferable from the service account JSON
- **Where:** Firebase Console → Project Settings → General → Project ID

**Mobile app** uses its own Firebase config (`google-services.json`, `GoogleService-Info.plist`, `firebase_options.dart`) — separate from the API service account.

---

## Web dashboard

### `NEXT_PUBLIC_API_URL`

- **Where:** Web
- **Required:** Yes — browser → API calls (`api-client`, billing, pricing, project setup snippets)
- **Format:** Must end in `/v1` (e.g. `http://localhost:8080/v1`)
- **Do not** double-prefix paths — client methods are relative to `/v1`

### `NEXT_PUBLIC_WS_URL`

- **Where:** Web
- **Required:** No — real-time log stream WebSocket
- **Default:** `ws://localhost:8080/v1` (hook appends `/stream`)
- **Format:** `ws://localhost:8080/v1/stream` (dev) or `wss://api.logstack.tech/v1/stream` (prod)

### `NEXT_PUBLIC_LOGSTACK_API_KEY`

- **Where:** Web
- **Required:** No — internal dashboard logger (`apps/web/src/lib/logger.ts`)
- **Where to get:** Dashboard → Projects → create project → copy API key
- **Without it:** Console logging still works (`disabled: true`); logs are not shipped

### `NODE_ENV`

- **Where:** Web (Next.js build/runtime) · SDK (JS auto-detect)
- **Required:** No — set automatically by Next.js; JS SDK reads it to pick `environment` when not passed explicitly

---

## SDK / log ingestion (user applications)

These are configured in **end-user apps**, not in the Logstack monorepo `.env`. SDKs accept constructor/config options; env var names below are common conventions your app can wire up.

| Variable / config key            | SDK              | Required           | Default                               |
| -------------------------------- | ---------------- | ------------------ | ------------------------------------- |
| `apiKey` / `LOGSTACK_API_KEY`    | JS · Python · Go | Yes (to ship logs) | —                                     |
| `endpoint` / `LOGSTACK_ENDPOINT` | JS               | No                 | `https://api.logstack.tech`           |
| `api_url`                        | Python           | No                 | `https://api.logstack.tech`           |
| `APIURL`                         | Go               | No                 | `https://api.logstack.tech`           |
| `environment`                    | JS · Python · Go | No                 | JS: auto from `NODE_ENV`              |
| `disabled`                       | JS               | No                 | `false` — set `true` for console-only |
| `NODE_ENV`                       | JS               | No                 | Auto-detects `environment`            |

**Ingest endpoint (all SDKs):** `POST {endpoint}/v1/logs` with `Authorization: Bearer {apiKey}`

**Console behavior (JS SDK):**

- `development`/`test`: console on by default; **still ships** if `apiKey` set and not `disabled`
- `production`/`staging`: console off by default; ships to server
- `disabled: true`: console-only, never ships (use when no API key locally)

---

## Billing

All billing vars are **API**-side. Billing is disabled when the relevant provider keys are empty.

### Paystack (Nigeria / NGN)

| Variable               | Required                       | Notes                                                                              |
| ---------------------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| `PAYSTACK_SECRET_KEY`  | Required for Paystack          | [Paystack Developer Settings](https://dashboard.paystack.com/#/settings/developer) |
| `PAYSTACK_PUBLIC_KEY`  | Optional                       | Stored in billing service; server-side Paystack integration                        |
| `PAYSTACK_WEBHOOK_URL` | Required for Paystack webhooks | Your API endpoint, e.g. `https://api.example.com/v1/webhooks/paystack`             |

### Polar (International / USD)

| Variable                | Required                    | Notes                                         |
| ----------------------- | --------------------------- | --------------------------------------------- |
| `POLAR_ACCESS_TOKEN`    | Required for Polar          | [Polar Dashboard](https://polar.sh/dashboard) |
| `POLAR_WEBHOOK_SECRET`  | Required for Polar webhooks | Polar webhook signing secret                  |
| `POLAR_PRODUCT_STARTER` | Required for Polar          | Starter tier product UUID                     |
| `POLAR_PRODUCT_PRO`     | Required for Polar          | Pro tier product UUID                         |

---

## Server & operations

| Variable              | Where  | Required | Default       | Purpose                                          |
| --------------------- | ------ | -------- | ------------- | ------------------------------------------------ |
| `PORT`                | API    | Yes      | `8080`        | API listen port (inside container)               |
| `API_HOST_PORT`       | Docker | No       | `8082`        | Host port mapped in Docker Compose               |
| `ENV`                 | API    | Yes      | `development` | `development` or `production`                    |
| `ALLOWED_ORIGINS`     | API    | No       | —             | Comma-separated CORS origins (never `*` in prod) |
| `READ_TIMEOUT`        | API    | No       | —             | Max time to read a request                       |
| `WRITE_TIMEOUT`       | API    | No       | —             | Max time to write a response                     |
| `IDLE_TIMEOUT`        | API    | No       | —             | Keep-alive timeout                               |
| `RATE_LIMIT_REQUESTS` | API    | No       | `100`         | Requests per window per IP                       |
| `RATE_LIMIT_WINDOW`   | API    | No       | `1m`          | Rate limit window                                |
| `LOG_LEVEL`           | API    | No       | `info`        | API slog level                                   |
| `LOG_JSON`            | API    | No       | `false`       | JSON logs for production aggregation             |
| `USAGE_SYNC_INTERVAL` | API    | No       | `1m`          | Usage metering sync interval                     |

### Docker-only (Postgres container)

| Variable            | Where  | Required           | Default    |
| ------------------- | ------ | ------------------ | ---------- |
| `POSTGRES_USER`     | Docker | No                 | `logstack` |
| `POSTGRES_PASSWORD` | Docker | Yes (prod compose) | —          |
| `POSTGRES_DB`       | Docker | No                 | `logstack` |

`DATABASE_URL` in the API `.env` must point at this Postgres instance when running via Docker.

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

**ALL DONE**
