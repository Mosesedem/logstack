# Logstack — Product Assessment & Update

> Written: May 2026

---

## What Logstack Is

Logstack is an open-source log management platform targeting engineering teams who want the power of tools like Datadog or Logtail without the enterprise price tag or vendor lock-in. The core value proposition is:

- **Real-time log streaming** via WebSockets
- **Smart alerting** with pattern matching and cooldowns
- **Self-hostable** with a single Docker container
- **Mobile companion app** for on-call engineers
- **A JavaScript SDK** that works in any Node.js or browser environment

The tech stack is solid: Go backend with Gin + GORM + PostgreSQL + Redis, Next.js 16 frontend with React 19, Flutter mobile app, and a TypeScript SDK. The architecture is well-thought-out and the code quality is generally good.

---

## Honest Assessment

### The Good

**Architecture is sound.** The separation between the ingestor, query builder, alert engine, and billing service is clean. The WebSocket hub with Redis pub/sub is the right approach for multi-instance real-time streaming. The JWT + refresh token flow is implemented correctly with token blacklisting.

**The SDK is genuinely useful.** Offline queuing, automatic batching, exponential backoff, browser/Node detection — these are the features that make a logging SDK production-worthy. The TypeScript types are thorough.

**The billing integration is ambitious.** Paystack integration with subscription management, webhook handling, and usage tracking is non-trivial work. The foundation is there.

**The web UI looks good.** The dark theme, gradient backgrounds, and component library give it a polished appearance that punches above its weight for an early-stage product.

---

### The Honest Problems

**The product is not yet shippable.** Several critical paths are broken or incomplete:

1. **OAuth login creates a session but no database user.** Google and GitHub sign-in will appear to work but every subsequent API call will fail silently.

2. **Alert rules for `info` and `warn` levels never fire.** The alert processor only queries `error` and `critical` logs. A user who sets up an alert for a specific info pattern will never receive it.

3. **Non-production logs are silently discarded.** The ingestor doesn't persist logs for non-production projects. The API returns 201 Created but the logs are gone. A developer testing their integration will see nothing in the dashboard and have no idea why.

4. **The audit logs page makes requests to `/v1/v1/audit`.** It's a 404 in production.

5. **Log retention is defined in the subscription model but never enforced.** The database will grow without bound.

6. **There is no home/dashboard page.** Users land directly on the logs list with no orientation.

7. **Footer links to 9 pages that don't exist.** `/about`, `/blog`, `/careers`, `/contact`, `/privacy`, `/terms`, `/cookies`, `/integrations`, `/changelog` are all 404s.

---

### The Positioning Gap

The README positions Logstack against Datadog and Logtail. That's a high bar. Those products have:

- Structured log parsing and field extraction
- Log-based metrics and dashboards
- Anomaly detection
- Integrations with Slack, PagerDuty, OpsGenie
- Kubernetes and Docker log collection agents
- Retention management UI

Logstack currently has none of these. The comparison sets expectations the product cannot yet meet.

A more honest positioning for the current state: **"The simplest way to add structured logging and real-time alerts to your Node.js app."** That's achievable today and genuinely valuable.

---

### The Mobile App

The Flutter app is in "private beta" with no public store links. The code exists and the architecture is reasonable (Riverpod, Dio, Hive). But it's not shippable without:

- A working API to connect to (the OAuth gap affects mobile too)
- Crash reporting
- Environment configuration (no hardcoded URLs)
- App Store / Play Store review process

The mobile app is a strong differentiator if it ships. Right now it's a liability in the marketing copy.

---

### The Missing SDKs

The landing page says "Type-Safe SDKs" for TypeScript, Go, and Python. Only TypeScript exists. Go and Python SDKs need to be built or the claim needs to be removed.

---

## What Needs to Happen

### Immediate (Before Any Public Launch)

1. Fix the OAuth backend endpoint — users need to be able to sign in with Google/GitHub
2. Fix the alert processor to handle all log levels
3. Fix the audit logs double-prefix bug
4. Add a log detail view to the web dashboard
5. Fix the non-production log persistence (or document the behavior clearly)
6. Remove or stub the broken footer links
7. Add a dashboard home/overview page

### Short Term (Next 4-6 Weeks)

1. Implement log retention deletion worker
2. Fix billing tier detection from Paystack plan codes
3. Add webhook alert channel implementation
4. Build the Go SDK (the backend is already Go — this is a natural fit)
5. Add a proper API key display UI (not a toast)
6. Add CI/CD pipeline with basic tests
7. Create docker-compose.yml for local development

### Medium Term (Next 2-3 Months)

1. Build onboarding flow (first project creation, first log, first alert)
2. Add log analytics charts (volume over time, error rate)
3. Add Slack integration for alerts
4. Ship mobile app to TestFlight / Play Store internal testing
5. Write the Python SDK
6. Add log field extraction / structured log parsing

---

## Verdict

Logstack has a strong foundation and a clear vision. The architecture is production-grade. The design is polished. The SDK is genuinely good.

But the product has too many broken paths to ship publicly right now. The gap between what the marketing copy promises and what the product delivers is significant. Fix the critical bugs first, then focus on the onboarding experience, then expand the feature set.

The core idea — simple, self-hostable logging with real-time streaming and mobile alerts — is genuinely differentiated. It's worth building properly.
