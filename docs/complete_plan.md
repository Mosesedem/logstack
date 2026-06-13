# Logstack — Complete Fix Plan

> All issues from `poor.md` tracked here with implementation details.
> Progress is tracked in `progress.md`.

---

## Phase 1 — Critical Bugs (Blockers)

These break core user flows and must be fixed before any public use.

### P1-1: Fix Alert Processor — All Log Levels

**File:** `packages/logstack-go/internal/workers/alert_processor.go`

- Remove the `level IN (error, critical)` filter — process all logs
- Add a `processed_for_alerts` boolean column to the logs table (migration 014)
- Query unprocessed logs instead of time-window polling
- Mark logs as processed after the alert engine runs
- Replace `fmt.Printf` with `slog`

### P1-2: Fix Alert Engine — Level-Only Rules

**File:** `packages/logstack-go/internal/services/alert_engine.go`

- Fix `matches()`: when `TriggerPattern` is empty and `TriggerLevel` matches, return `true`
- Compile regexes once and cache them (map[ruleID]\*regexp.Regexp)
- Remove the production-only restriction or make it configurable per rule

### P1-3: Add OAuth Backend Endpoint

**File:** `packages/logstack-go/internal/api/handlers/auth.go` (new handler)

- Add `POST /v1/auth/oauth` endpoint
- Accept `{provider, providerAccountId, email, name, image}` from NextAuth
- Find or create user by email
- Return JWT tokens
- Update NextAuth config to call this endpoint in the `signIn` callback

### P1-4: Fix Audit Logs Double-Prefix

**File:** `apps/web/src/app/(dashboard)/settings/audit/page.tsx`

- Remove `/v1` prefix from both API calls (base URL already includes it)
- Change `/v1/audit/actions` → `/audit/actions`
- Change `/v1/audit?...` → `/audit?...`

### P1-5: Fix Non-Production Log Behavior

**File:** `packages/logstack-go/internal/services/ingestor.go`

- Option A: Persist all logs regardless of environment (simplest fix)
- Option B: Add `X-Logstack-Ephemeral: true` response header for non-production
- Add a comment in the API response body: `"ephemeral": true` for non-production
- Document this behavior in the SDK and API docs

### P1-6: Add Missing DB Migration — verification_rate_limits

**File:** `packages/logstack-go/migrations/014_create_verification_rate_limits.up.sql`

```sql
CREATE TABLE IF NOT EXISTS verification_rate_limits (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_vrl_email_sent ON verification_rate_limits(email, sent_at);
```

### P1-7: Fix Admin Route Protection

**File:** `apps/web/src/app/admin/layout.tsx`

- Add server-side session check using `getServerSession`
- Redirect to `/login` if no session or not admin role
- Remove the client-side 403 catch-and-redirect pattern

---

## Phase 2 — UX & Missing Features

### P2-1: Add Dashboard Home Page

**File:** `apps/web/src/app/(dashboard)/page.tsx` (new)

- Summary cards: total logs today, error rate, active alerts
- Log volume chart (last 24h) using Recharts
- Recent errors list (last 5 error/critical logs)
- Quick action: "View Logs", "Create Alert", "Invite Team"
- Add "Home" link to sidebar

### P2-2: Add Log Detail View

**File:** `apps/web/src/app/(dashboard)/logs/[id]/page.tsx` (new)

- Full log entry with all metadata fields expanded
- JSON syntax highlighting for metadata
- Copy log ID button
- "Create Alert from this log" shortcut
- Back navigation to logs list

### P2-3: Fix API Key Display

**File:** `apps/web/src/app/(dashboard)/projects/page.tsx`

- Replace toast with a modal dialog showing the API key
- Masked display with "Click to reveal" toggle
- Copy-to-clipboard button with confirmation
- Warning: "This key will not be shown again"

### P2-4: Fix LogLevel Type — Add debug and fatal

**File:** `apps/web/src/types/index.ts`

```typescript
export type LogLevel =
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "critical"
  | "fatal";
```

**File:** `apps/web/src/components/logs/level-badge.tsx`

- Add color mappings for `debug` (gray) and `fatal` (purple)

### P2-5: Fix Session Refresh After Profile Update

**File:** `apps/web/src/app/(dashboard)/settings/page.tsx`

- Call `update()` from `useSession` after successful profile mutation
- This triggers NextAuth to re-fetch the session with updated name

### P2-6: Add Empty States

- Projects page: "Create your first project" with illustration and CTA
- Logs page: "No logs yet — here's how to send your first log" with code snippet
- Alerts page: "No alert rules — create one to get notified"

### P2-7: Add/Fix Footer Pages

- Create `/privacy`, `/terms` as static MDX pages (minimal legal boilerplate)
- Create `/contact` page with email form or mailto link
- Remove links to `/integrations`, `/changelog`, `/about`, `/blog`, `/careers` until they exist (or add "Coming Soon" pages)

---

## Phase 3 — Backend Completeness

### P3-1: Implement Log Retention Worker

**File:** `packages/logstack-go/internal/workers/log_retention.go` (new)

- Run daily at 2am UTC
- For each project, look up owner's subscription tier
- Delete logs older than the retention period for that tier
- Log deletion counts with slog

### P3-2: Fix Billing — Tier Detection

**File:** `packages/logstack-go/internal/services/billing_service.go`

- Store tier in Paystack metadata when initializing payment
- In `handleSubscriptionCreate`, read tier from metadata instead of plan code
- Fix `CancelSubscription` to use the correct Paystack disable token (fetch from subscription object)
- Add idempotency key to webhook processing (store processed event IDs in Redis)

### P3-3: Implement Webhook Alert Channel

**File:** `packages/logstack-go/internal/services/notification/webhook.go` (new)

- HTTP POST to the configured recipient URL
- JSON payload: `{alertId, ruleName, log, triggeredAt}`
- Retry with exponential backoff (3 attempts)
- Record success/failure in alert history

### P3-4: Fix WebSocket — Backpressure & Auth

**File:** `packages/logstack-go/internal/websocket/hub.go`

- Increase send buffer from default to 512
- On slow client: send a "buffer_full" message before disconnecting
- Add per-project client limit (configurable, default 50)
- Add token expiry check on message receive (not just on connect)

### P3-5: Fix pnpm Config Location

**File:** `package.json` (root)

- Move `pnpm` configuration from `apps/web/package.json` to root `package.json`
- This eliminates the Vercel build warning

### P3-6: Fix Middleware Deprecation

**File:** `apps/web/proxy.ts` (already exists)

- Ensure `middleware.ts` is removed or renamed
- Verify `proxy.ts` handles all the same routes

---

## Phase 4 — Infrastructure & Security

### P4-1: Add docker-compose.yml

**File:** `docker-compose.yml` (new at root)

```yaml
services:
  api:
    build: ./packages/logstack-go
    ports: ["8080:8080"]
    depends_on: [postgres, redis]
  postgres:
    image: postgres:16-alpine
    environment:
      {
        POSTGRES_DB: logstack,
        POSTGRES_USER: logstack,
        POSTGRES_PASSWORD: logstack,
      }
  redis:
    image: redis:7-alpine
```

### P4-2: Add GitHub Actions CI

**File:** `.github/workflows/ci.yml` (new)

- Go: `go test ./...` + `go vet ./...`
- Web: `pnpm build` (already works)
- Lint: `golangci-lint` for Go, `eslint` for TypeScript

### P4-3: Fix Security Defaults

**File:** `.env.example`

- Change `ALLOWED_ORIGINS=*` to `ALLOWED_ORIGINS=http://localhost:3000`
- Add comment: "⚠️ Change to your domain in production"
- Add `JWT_SECRET` generation command in comments: `openssl rand -base64 32`

### P4-4: Add XSS Protection to Log Rendering

**File:** `apps/web/src/components/logs/log-card.tsx`

- Ensure log messages are rendered as text, not HTML
- Verify no `dangerouslySetInnerHTML` is used with log content

### P4-5: Fix Firebase Options

**File:** `apps/mobile/lib/firebase_options.dart`

- Add to `.gitignore`
- Add `firebase_options.dart.example` with placeholder values
- Document in README how to generate this file with `flutterfire configure`

---

## Phase 5 — SDK Expansion

### P5-1: Build Go SDK

**File:** `packages/logstack-go-sdk/` (new package)

- Mirror the JS SDK API: `NewClient(config)`, `Info()`, `Error()`, `Flush()`
- Batch sending with configurable interval
- Context-aware (pass `context.Context` to all methods)
- Structured fields support

### P5-2: Build Python SDK

**File:** `packages/logstack-python/` (new package)

- `pip install logstack`
- `LogStackClient(api_key=...)` with `info()`, `error()`, `flush()`
- Django and FastAPI middleware helpers
- Async support with `asyncio`

---

## Implementation Order

```
Week 1:  P1-1, P1-2, P1-3, P1-4, P1-5, P1-6, P1-7
Week 2:  P2-1, P2-2, P2-3, P2-4, P2-5
Week 3:  P2-6, P2-7, P3-1, P3-2
Week 4:  P3-3, P3-4, P3-5, P3-6
Week 5:  P4-1, P4-2, P4-3, P4-4, P4-5
Week 6+: P5-1, P5-2
```

---

## Definition of Done

Each item is complete when:

1. Code is written and compiles/builds without errors
2. The specific bug or missing feature is verified fixed
3. No new TypeScript or Go compiler errors introduced
4. `progress.md` is updated with status
