# Logstack — Critical Review & Issues

> A thorough, honest criticism of the current state of the codebase across all services.
> Documented: May 2026

---

## 1. API (packages/logstack-go)

### 1.1 Alert Processor — Fundamental Design Flaw

**File:** `internal/workers/alert_processor.go`

The alert processor polls the database every 5 seconds for logs created in the last 1 minute:

```go
Where("level IN (?, ?) AND created_at > ?", models.LogLevelError, models.LogLevelCritical, time.Now().Add(-1*time.Minute))
```

**Problems:**

- Only processes `error` and `critical` levels. Alert rules can be configured for `info` and `warn` levels too — those are silently ignored.
- No deduplication. If a log is created at T=0 and the processor runs at T=5s and T=65s, the same log is processed twice. There is no `processed` flag on the log model.
- The 1-minute lookback window means logs ingested just before the window boundary can be missed entirely.
- `ProcessLogAsync` uses `context.Background()` — no timeout, no cancellation, no observability.
- The processor uses `fmt.Printf` for errors instead of the structured `slog` logger used everywhere else.

---

### 1.2 Alert Engine — Broken Match Logic

**File:** `internal/services/alert_engine.go`

```go
func (e *AlertEngine) matches(rule models.AlertRule, log *models.Log) bool {
    if rule.TriggerLevel != "" && rule.TriggerLevel != log.Level {
        return false
    }
    if rule.TriggerPattern != "" {
        matched, err := regexp.MatchString(rule.TriggerPattern, log.Message)
        if err != nil {
            return false
        }
        return matched
    }
    return false  // ← BUG: returns false when pattern is empty
}
```

**Problems:**

- If a rule has a `TriggerLevel` but no `TriggerPattern`, the function returns `false`. A level-only alert rule never fires.
- `regexp.MatchString` is called on every log for every rule — no regex compilation cache. Under load this is extremely expensive.
- Alerts only fire for `production` environment projects. This is hardcoded and undocumented. A developer testing alerts in `staging` will never see them fire.
- No metadata-based matching. You cannot alert on `metadata.statusCode == 500`.

---

### 1.3 Ingestor — Non-Production Logs Silently Dropped

**File:** `internal/services/ingestor.go`

```go
if project.Environment != "production" {
    // ...publish to Redis for real-time only
    return logModels, nil  // ← not persisted
}
```

**Problems:**

- Non-production logs are never stored in the database. The SDK returns success (201) but the logs are gone after the Redis TTL expires.
- The web dashboard queries the database. A developer using a `staging` project will see an empty log list with no explanation.
- No documentation or warning in the API response that logs are ephemeral for non-production projects.
- Usage is not tracked for non-production projects, which is correct, but the behavior is completely invisible to the user.

---

### 1.4 Billing Service — Fragile Tier Detection

**File:** `internal/services/billing_service.go`

```go
func (s *BillingService) getTierFromPlanCode(planCode string) models.SubscriptionTier {
    switch {
    case contains(planCode, "starter"):
        return models.TierStarter
    ...
    }
}
```

**Problems:**

- Paystack plan codes are opaque strings like `PLN_abc123xyz`. The function tries to detect the tier by checking if the plan code _contains_ the tier name — but Paystack plan codes don't contain the plan name.
- The custom `contains`/`equalFold` functions re-implement `strings.Contains` and `strings.EqualFold` from the standard library. This is dead code that adds confusion.
- `handleChargeSuccess` is a no-op stub. One-time charges and upgrades are silently ignored.
- `CancelSubscription` passes the subscription code as both `code` and `token` in the disable request. Paystack's disable endpoint requires an email token, not the subscription code.
- No idempotency handling on webhooks. Duplicate webhook deliveries will double-process events.
- Transaction history is fetched from Paystack by `customerCode`, but `customerCode` is only set after the first successful payment. New users with no payment history will get an API error.

---

### 1.5 Auth Handler — Rate Limit Table Missing

**File:** `internal/api/handlers/auth.go`

```go
h.db.Exec("INSERT INTO verification_rate_limits (email, sent_at) VALUES (?, ?)", email, time.Now())
```

**Problems:**

- The `verification_rate_limits` table is referenced in code but there is no migration for it. This will silently fail in production.
- The fallback rate limit check queries a non-existent table, meaning the Redis-only path is the only one that works.
- `checkVerificationRateLimit` returns `true` (allow) on any Redis error. A Redis outage disables rate limiting entirely.

---

### 1.6 WebSocket Hub — No Backpressure

**File:** `internal/websocket/hub.go`

```go
case client.send <- message.Data:
default:
    // drop client
    delete(clients, client)
    close(client.send)
```

**Problems:**

- A slow client is silently disconnected with no notification. The client will attempt to reconnect (every 3 seconds per the web hook) creating a reconnect storm under load.
- The broadcast channel has a buffer of 256. Under high log volume this will block the entire hub goroutine.
- No authentication check in the hub itself — authentication is done at the HTTP upgrade level, but the hub has no way to revoke a connected client if their token expires.
- No per-project client limit. A single project could exhaust all server connections.

---

### 1.7 Router — Duplicate Log Query Handlers

**File:** `internal/api/router.go` + `internal/api/handlers/logs.go`

There are two separate handlers for querying logs:

- `GET /v1/logs` — uses API key auth, requires `projectId` as query param
- `GET /v1/projects/:id/logs` — uses JWT auth, reads project from URL

Both call `queryBuilder.Query()` with identical logic. This is duplicated code that will diverge over time.

---

### 1.8 Missing: Log Retention / Deletion

There is no mechanism to delete old logs. The subscription model defines retention periods (7 days free, 30 days starter, 90 days pro) but:

- No migration adds a retention policy column.
- No worker deletes expired logs.
- The database will grow unbounded in production.

---

### 1.9 Missing: OAuth Endpoint

The NextAuth config supports Google and GitHub OAuth, but there is no `/v1/auth/oauth` endpoint on the backend. OAuth sign-ins via the web app will create a NextAuth session but never create a user in the database. The user will appear logged in but all API calls requiring a real user ID will fail.

---

### 1.10 Missing: Webhook Alert Channel

The `AlertRule` model has `channel: "webhook"` as a valid option. The `notification.Service` has no webhook sender implementation. Webhook alerts are silently dropped.

---

## 2. Web App (apps/web)

### 2.1 No Home/Dashboard Page

The dashboard has no home/overview page. After login, the user lands on `/logs` directly. There is no:

- Summary of recent activity
- Log volume chart
- Error rate trend
- Quick links to recent alerts

The sidebar has no "Home" or "Overview" link.

---

### 2.2 Logs Page — Real-time Deduplication

**File:** `apps/web/src/app/(dashboard)/logs/page.tsx`

```typescript
const allLogs = [
  ...realtimeLogs,
  ...(data?.pages.flatMap((p) => p.logs) ?? []),
];
```

**Problems:**

- Real-time logs and paginated logs are concatenated without deduplication. A log that arrives via WebSocket and is also in the first page of results will appear twice.
- `realtimeLogs` is capped at 100 entries in the hook but there is no cap on the combined list. With infinite scroll, the list can grow to thousands of DOM nodes.
- The WebSocket URL uses `/mobile/stream` — a mobile-specific endpoint — for the web dashboard. This is semantically wrong and couples the web app to the mobile API.

---

### 2.3 Settings Page — Session Not Refreshed After Profile Update

**File:** `apps/web/src/app/(dashboard)/settings/page.tsx`

After updating the user's name, the NextAuth session is not refreshed. The header will continue showing the old name until the user logs out and back in.

---

### 2.4 Audit Logs Page — Wrong API Path

**File:** `apps/web/src/app/(dashboard)/settings/audit/page.tsx`

```typescript
const response = await apiClient.get<{ actions: string[] }>(
  "/v1/audit/actions",
);
// ...
const response = await apiClient.get<AuditLogsResponse>(`/v1/audit?${params}`);
```

The `apiClient` base URL is already `http://localhost:8080/v1`. Prepending `/v1` again results in requests to `/v1/v1/audit` — a 404 in production.

---

### 2.5 Admin Page — No Route Protection

**File:** `apps/web/src/app/admin/page.tsx`

```typescript
if (e.message.includes("403")) {
  router.push("/");
}
```

Admin route protection is done client-side by catching a 403 error after the request is already made. The admin page content briefly renders before the redirect. This should be a server-side middleware check.

---

### 2.6 Projects Page — API Key Shown in Toast

**File:** `apps/web/src/app/(dashboard)/projects/page.tsx`

```typescript
toast({
  title: "Project created",
  description: `API Key: ${project.apiKey}`,
});
```

The API key is shown in a toast notification that auto-dismisses after a few seconds. If the user misses it, the key is gone — there is no way to view the API key again after creation (only rotate it). This is a poor UX pattern for a security-sensitive value.

---

### 2.7 Missing Pages (Footer Links Lead to 404)

The footer links to pages that don't exist:

- `/integrations`
- `/changelog`
- `/about`
- `/blog`
- `/careers`
- `/contact`
- `/privacy`
- `/terms`
- `/cookies`

These are all 404s. For a product marketing itself as production-ready, this is a significant credibility issue.

---

### 2.8 Missing: Log Detail View

There is a `log-detail-screen.dart` in the mobile app but no log detail page in the web app. Clicking a log card in the list does nothing. Users cannot expand metadata, copy log IDs, or see full stack traces.

---

### 2.9 Missing: Empty States

Most pages have no meaningful empty state:

- New users with no projects see a blank projects grid.
- The logs page shows "Select a project to view logs" but gives no guidance on how to create one or send the first log.
- No onboarding flow or getting-started wizard.

---

### 2.10 Type Inconsistency — `LogLevel` Missing Values

**File:** `apps/web/src/types/index.ts`

```typescript
export type LogLevel = "info" | "warn" | "error" | "critical";
```

The backend SDK (`packages/logstack-js`) supports `debug` and `fatal` levels. The web types don't include them. Logs with `debug` or `fatal` levels will render incorrectly in `LevelBadge` (missing color mapping).

---

## 3. JavaScript SDK (packages/logstack-js)

### 3.1 Development Mode Silently Drops All Logs

The SDK checks `environment === 'development'` and skips sending to the server. This is by design but:

- There is no console warning that logs are not being sent.
- Auto-detection of environment can misfire (e.g., a staging server with `NODE_ENV=development`).
- The `consoleInProduction` flag is confusingly named — it controls console output in production, not whether production logs are sent.

---

### 3.2 Offline Queue Has No Size Limit

```typescript
const OFFLINE_STORAGE_KEY = "logstack_offline_queue";
const OFFLINE_STORAGE_TTL = 24 * 60 * 60 * 1000;
```

The offline queue writes to `localStorage` with no size cap. `localStorage` is typically limited to 5-10MB. A high-volume application that goes offline will fill `localStorage`, causing `setItem` to throw a `QuotaExceededError` that is not caught.

---

### 3.3 No Go SDK

The README and landing page mention "Type-Safe SDKs" for TypeScript, Go, and Python. Only the TypeScript SDK exists. The Go and Python SDKs are missing entirely.

---

## 4. Mobile App (apps/mobile)

### 4.1 Hardcoded API URL

**File:** `apps/mobile/lib/services/api_client.dart` (inferred from structure)

Flutter apps typically hardcode the API URL in the service layer. There is no environment configuration system visible in the pubspec or dart files. Switching between dev/staging/prod requires a code change.

---

### 4.2 Firebase Options Committed

**File:** `apps/mobile/lib/firebase_options.dart`

Firebase configuration files contain API keys and project IDs. This file is committed to the repository. While Firebase API keys are not secret in the same way as backend keys, committing them is against best practices and can lead to quota abuse.

---

### 4.3 No Error Boundary / Crash Reporting

The mobile app uses Firebase for push notifications but there is no crash reporting (Firebase Crashlytics or Sentry). Production crashes will be invisible.

---

## 5. Infrastructure & DevOps

### 5.1 No CI/CD Pipeline

The `.github` folder exists but no workflow files are visible. There are no:

- Automated tests on PR
- Build verification
- Deployment pipelines
- Security scanning

---

### 5.2 No Docker Compose for Full Stack

There is a `Dockerfile` for the Go backend but no `docker-compose.yml` that brings up the full stack (API + PostgreSQL + Redis). The README references self-hosting but there is no working local setup script.

---

### 5.3 `pnpm` Config in Wrong Place

Vercel build logs warn: `The field "pnpm" was found in /vercel/path0/apps/web/package.json. This will not take effect.`

The `pnpm` configuration belongs in the root `package.json`, not in the app-level one.

---

### 5.4 Middleware Deprecation Warning

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

The `proxy.ts` file exists but the old `middleware` convention is still triggering a warning. This needs to be cleaned up before Next.js removes the old convention entirely.

---

## 6. Security Issues

### 6.1 ALLOWED_ORIGINS Defaults to `*`

**File:** `.env.example`

```
ALLOWED_ORIGINS=*
```

The default CORS configuration allows all origins. This is documented as "development only" but it's the default value. A developer who copies `.env.example` to `.env` and deploys to production will have an open CORS policy.

---

### 6.2 JWT Secret Has a Weak Default

```
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

This is a known, public default. Any deployment that forgets to change it is trivially compromised.

---

### 6.3 No Input Sanitization on Log Messages

Log messages are stored as raw strings and rendered in the web UI. There is no HTML sanitization. If log messages contain `<script>` tags or other HTML, they could cause XSS in the dashboard.

---

### 6.4 API Key Visible in Toast (Repeated from §2.6)

The API key is shown once in a dismissible toast. There is no secure key display pattern (masked with reveal button, copy-to-clipboard with confirmation).

---

## 7. Summary Scorecard

| Area            | Score | Key Issue                                             |
| --------------- | ----- | ----------------------------------------------------- |
| API — Auth      | 7/10  | Missing OAuth endpoint, missing DB table              |
| API — Logs      | 6/10  | Non-production logs silently dropped, no retention    |
| API — Alerts    | 4/10  | Broken match logic, only error/critical processed     |
| API — Billing   | 5/10  | Fragile tier detection, broken cancel, no idempotency |
| API — WebSocket | 6/10  | No backpressure, no auth revocation                   |
| Web — Dashboard | 5/10  | No home page, no log detail, broken audit path        |
| Web — UX        | 4/10  | Missing pages, poor empty states, API key in toast    |
| SDK — JS        | 7/10  | Silent dev mode, no queue size limit                  |
| SDK — Go/Python | 0/10  | Does not exist                                        |
| Mobile          | 5/10  | Hardcoded URL, committed Firebase config              |
| Infrastructure  | 3/10  | No CI, no compose, no tests                           |
| Security        | 5/10  | Weak defaults, no XSS protection                      |
