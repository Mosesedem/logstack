---
name: logstack-web-api
description: >
  End-to-end guide for Logstack web dashboard, Go API, SDK ingestion, alerts,
  and notifications. Use when working on apps/web, packages/logstack-go, user
  onboarding, alert rules, email/push delivery, SDK docs, or verifying that
  logs and notifications flow correctly from project creation to production.
---

# Logstack Web, API & Notifications

You are working on **Logstack** — ingest logs via SDKs → store/stream → dashboard
with alerts and billing. This skill is the authoritative playbook for wiring the
**user journey** and keeping web, API, and SDK behavior aligned.

**Read first:** `docs/env_vars.md` for every secret and where to obtain it.

---

## The golden path (what users should experience)

Every change should preserve or improve this flow:

```
Sign up → Verify email → Create project → Copy API key
    → Set up first alert (prompted) → Install SDK → Logs appear
    → Alerts fire → Email / push / webhook delivered
```

### Step 1 — Account & email verification

| Layer | What happens | Key files |
|-------|--------------|-----------|
| Web signup | `POST /v1/auth/signup` via web | `apps/web/src/app/(auth)/signup/` |
| API | Creates user, sends verification email async | `handlers/auth.go` |
| Web banner | `EmailVerificationBanner` when `emailVerified === false` | `components/layout/email-verification-banner.tsx` |
| Resend | `POST /v1/auth/resend-verification` (rate-limited) | `handlers/auth.go` |

**Requires:** at least one email provider + `BASE_URL` in API env. See `docs/env_vars.md`.

**Gotcha:** Login does not block unverified users server-side — the banner is the UX gate.

### Step 2 — Create project (API key)

| Layer | What happens | Key files |
|-------|--------------|-----------|
| Web | Projects page → name → `POST /projects` | `apps/web/src/app/(dashboard)/projects/page.tsx` |
| Onboarding | `ProjectOnboardingWizard`: API key → alert form → SDK | `components/projects/project-onboarding-wizard.tsx` |

**After create, always run the 3-step wizard** (see `logstack-onboarding-ux` skill):
1. Copy API key (acknowledgment required)
2. **Customize alert** via shared `AlertFormFields` (not a rigid summary)
3. SDK install snippet → `/demo` or `/logs`

Key rotation uses `ApiKeyRevealDialog` only — never the full wizard.

### Step 3 — Alerts (create on project, edit on Alerts page)

| When | UX |
|------|-----|
| Project creation | Prompt first alert (email, error level, common patterns) |
| `/alerts` | **Edit** existing rules + **add** new ones; empty state has CTA |
| Channels | `email`, `push`, `webhook` — multi-channel supported server-side |

**Key files:**
- `apps/web/src/app/(dashboard)/alerts/page.tsx`
- `apps/web/src/components/alerts/alert-form.tsx`
- `packages/logstack-go/internal/api/handlers/alerts.go`
- `packages/logstack-go/internal/services/alert_engine.go`
- `packages/logstack-go/internal/services/notification/service.go`

**Alert rule shape (API + UI):**
```json
{
  "name": "Error alerts",
  "triggerLevel": "error",
  "triggerPatterns": [".*error.*", ".*exception.*"],
  "channels": ["email"],
  "recipient": "user@example.com",
  "cooldownMinutes": 15,
  "enabled": true
}
```

**Push channel:** `recipient` can be the user's email when combined with email — the API resolves push delivery to the **project owner's user ID** automatically. Mobile devices must register via `POST /v1/mobile/push-token`.

**Backend matching rules:**
- `triggerPatterns[]` OR legacy `triggerPattern` — any matching regex fires
- `channels[]` OR legacy `channel` — all configured channels receive delivery
- Cooldown per rule in Redis (`alert:{id}:cooldown`), set only on success

### Step 4 — Install SDK & ship logs

**Endpoint (all SDKs):** `POST {host}/v1/logs` with `Authorization: Bearer {apiKey}`

| SDK | Package | Console behavior |
|-----|---------|------------------|
| JS/TS | `logstack-js` | Dev: console ON + ships if key set. `disabled: true` = console-only |
| Python | `logstack-py` | Network only — no console mirror |
| Go | `logstack-go-sdk` | Network only |

**JS SDK config pattern (always use):**
```typescript
import { createLogStack } from "logstack-js";

const logstack = createLogStack({
  apiKey: process.env.LOGSTACK_API_KEY ?? "",
  endpoint: process.env.LOGSTACK_ENDPOINT ?? "https://api.logstack.tech",
  disabled: !process.env.LOGSTACK_API_KEY,  // console-only fallback
  consoleInProduction: false,
  onError: (err, logs) => { /* never swallow silently in app code */ },
});
```

**Web dashboard logger** (`apps/web/src/lib/logger.ts`):
- No `NEXT_PUBLIC_LOGSTACK_API_KEY` → warns once, `disabled: true`, **console still works**
- Never replace the client with a no-op

**Ingestion truth (verify against code, not old docs):**
- Backend **persists all project environments** (dev/staging/prod) to Postgres + Redis stream
- Usage metering is **production projects only**
- SDK `environment` field in POST body is **not** used for filtering — project DB env matters for billing only

### Step 5 — View logs & get notified

| Feature | Path |
|---------|------|
| Log list | `/logs` — REST + WebSocket stream |
| Alert history | `/alerts` → History tab → `GET /alerts/:id/history` |
| Email alert | `notification/email.go` provider chain |
| Push alert | `notification/push.go` via FCM HTTP v1 |
| Webhook | `notification/webhook.go` POST to `recipient` URL |

**Alert processor:** `workers/alert_processor.go` polls recent logs every 5s. Ingest does not yet call `ProcessLogAsync` — expect slight delay, not instant.

---

## Environment variables (summary)

Full reference: **`docs/env_vars.md`**

| Category | Must-have for notifications |
|----------|----------------------------|
| Email | `BASE_URL` + one of `RESEND_API_KEY`, `BREVO_API_KEY`, `MAILCOW_*`, `ZOHO_*` |
| Push | `FCM_SERVICE_ACCOUNT_PATH` (+ optional `FCM_PROJECT_ID`) |
| Web | `NEXT_PUBLIC_API_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` |
| SDK (user app) | `LOGSTACK_API_KEY` |

---

## File map (where to look)

```
apps/web/
  src/app/(dashboard)/projects/page.tsx    # project create + onboarding
  src/app/(dashboard)/alerts/page.tsx      # alert edit/add hub
  src/components/projects/project-onboarding-dialog.tsx
  src/components/alerts/alert-form.tsx
  src/lib/logger.ts                        # dashboard SDK (no silent no-op)
  content/docs/sdk/                        # user-facing SDK docs

packages/logstack-go/
  internal/api/handlers/auth.go            # email verification
  internal/api/handlers/alerts.go          # alert CRUD
  internal/api/handlers/mobile/push_tokens.go
  internal/services/ingestor.go            # log persistence (all envs)
  internal/services/alert_engine.go        # rule matching
  internal/services/notification/          # email, push, webhook
  internal/workers/alert_processor.go      # alert polling worker

packages/logstack-js/src/index.ts          # JS SDK console/send decoupling
docs/env_vars.md                           # all secrets & where to find them
docs/SDK.md                                # authoritative JS SDK docs
docs/API.md                                # authoritative API docs
```

---

## Checklists

### Before claiming "notifications work"

- [ ] At least one email provider configured; send test signup email
- [ ] `BASE_URL` matches web dashboard URL (verification links work)
- [ ] FCM service account mounted; API logs "push notifier enabled"
- [ ] Mobile app registers token via `POST /v1/mobile/push-token` after login
- [ ] Alert rule exists with correct `channels` and `triggerPatterns`
- [ ] Ingest a matching log: `POST /v1/logs` with `level: error`, message containing `error`
- [ ] Check `alert_history` table or `/alerts` History tab for `success` status

### Before claiming "SDK console.log works"

- [ ] JS: `disabled: false` (or unset) with valid `apiKey` → console + network in dev
- [ ] JS: `disabled: true` without key → console output, no network, one warning
- [ ] Web `logger.ts` uses real client with `disabled: !apiKey`, not a no-op
- [ ] `packages/logstack-js/test/sdk.test.ts` passes
- [ ] Ingested log appears in dashboard `/logs` for the project

### Before changing alert UX

- [ ] Project creation prompts alert setup (onboarding dialog step 2)
- [ ] Alerts page empty state has "Create your first alert" CTA
- [ ] Alert form resets when switching edit targets (`useEffect` on `open` + `initialData`)
- [ ] `defaultRecipient` pre-fills session email on create
- [ ] Docs match UI fields (`triggerPatterns`, `channels`) not legacy `condition.threshold`

### Before changing API paths

- [ ] `apiClient` base URL ends in `/v1` — paths are relative (`/alerts`, not `/v1/alerts`)
- [ ] SDK posts to `/v1/logs`, not `/v1/logs/ingest`
- [ ] Auth header is `Bearer {token}`, not `X-API-Key` for JWT routes

---

## Common bugs (verified in this repo)

1. **Silent no-op logger** — fixed in `logger.ts`; use `disabled`, not a fake client
2. **Stale docs saying dev doesn't ship** — JS ships in all envs when `apiKey` + `!disabled`
3. **Multi-channel alerts ignored** — fixed in `notification/service.go` (`channels[]`)
4. **Multi-pattern alerts ignored** — fixed in `alert_engine.go` (`triggerPatterns[]`)
5. **Push recipient must be user ID** — mitigated: email recipient + push channel resolves to project owner
6. **Double `/v1`** — web `apiClient` already includes `/v1` prefix

---

## Documentation to keep in sync

When changing behavior, update these together:

| File | Audience |
|------|----------|
| `docs/env_vars.md` | Operators / deployers |
| `docs/SDK.md` | SDK users |
| `docs/API.md` | API consumers |
| `apps/web/content/docs/sdk/configuration.mdx` | Web docs site |
| `apps/web/content/docs/api/logs.mdx` | Web docs site |
| `CLAUDE.md` known gotchas | Agents |

**Never document** `/v1/logs/ingest` or `X-API-Key` for ingest — use `POST /v1/logs` + `Bearer`.

---

## Local dev commands

```bash
# Infrastructure
docker compose -f docker-compose.dev.yml up -d

# API
cp .env.example .env   # fill secrets — see docs/env_vars.md
cd packages/logstack-go && go run ./cmd/server

# Web
pnpm --filter @logstack/web dev

# Test ingest
curl -X POST http://localhost:8080/v1/logs \
  -H "Authorization: Bearer YOUR_PROJECT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"logs":[{"level":"error","message":"test exception in payment"}]}'
```

---

## Code style

Follow `.claude/skills/go-and-typescript/SKILL.md` for Go and TypeScript conventions.
Use `slog` in Go, never `fmt.Print*`. No silent `catch {}` in TS.