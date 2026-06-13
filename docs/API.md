# Logstack API Reference

**Base URL**

- Production: `https://api.logstack.tech/v1`
- Development: `http://localhost:8080/v1`

**Authentication**

JWT (dashboard endpoints):

```
Authorization: Bearer <access_token>
```

API Key (log ingestion endpoints):

```
Authorization: Bearer ls_<project_api_key>
```

---

## Authentication

### POST /auth/signup

Register a new user.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "Jane Doe"
}
```

**Response `201`:**

```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "Jane Doe",
    "emailVerified": false,
    "createdAt": "2026-01-15T10:30:00Z"
  },
  "tokens": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "expiresIn": 900
  }
}
```

**Errors:** `409 EMAIL_EXISTS`, `400 VALIDATION_ERROR`

---

### POST /auth/login

Authenticate an existing user.

**Request:**

```json
{ "email": "user@example.com", "password": "securepassword123" }
```

**Response `200`:** Same shape as signup.

**Errors:** `401 INVALID_CREDENTIALS`

---

### POST /auth/oauth

Sync an OAuth sign-in (Google / GitHub) with the backend. Called automatically by NextAuth.

**Request:**

```json
{
  "provider": "google",
  "providerId": "1234567890",
  "email": "user@example.com",
  "name": "Jane Doe",
  "image": "https://..."
}
```

**Response `200`:** Same shape as login.

---

### POST /auth/refresh

Exchange a refresh token for a new access token.

**Request:**

```json
{ "refreshToken": "eyJhbGci..." }
```

**Response `200`:**

```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "expiresIn": 900
}
```

---

### POST /auth/logout

Invalidate the current access token. Requires JWT auth.

**Response `200`:** `{ "message": "Logged out successfully" }`

---

### POST /auth/forgot-password

Request a password reset email.

**Request:** `{ "email": "user@example.com" }`

**Response `200`:** Always returns success to prevent email enumeration.

---

### POST /auth/reset-password

Reset password using the token from the email link.

**Request:**

```json
{ "token": "abc123...", "password": "newpassword123" }
```

**Response `200`:** `{ "message": "Password updated successfully" }`

---

### GET /auth/verify-email?token=abc123

Verify an email address.

**Response `200`:** `{ "message": "Email verified successfully" }`

**Errors:** `400 INVALID_TOKEN`, `400 TOKEN_EXPIRED`

---

### POST /auth/resend-verification

Resend the verification email. Rate limited to 3 per hour.

**Request:** `{ "email": "user@example.com" }`

**Response `200`:** Always returns success.

---

## Projects

All project endpoints require JWT auth.

### GET /projects

List all projects for the authenticated user.

**Response `200`:**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My App",
    "ownerId": 1,
    "environment": "production",
    "createdAt": "2026-01-15T10:30:00Z"
  }
]
```

---

### POST /projects

Create a new project.

**Request:** `{ "name": "My New App" }`

**Response `201`:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My New App",
  "ownerId": 1,
  "apiKey": "ls_a1b2c3d4e5f6...",
  "environment": "production",
  "createdAt": "2026-01-15T10:30:00Z"
}
```

> **Note:** The `apiKey` is only returned on creation. Store it securely — it cannot be retrieved again, only rotated.

---

### GET /projects/:id

Get project details. Requires project ownership.

---

### PUT /projects/:id

Update project name. Requires project ownership.

**Request:** `{ "name": "Updated Name" }`

---

### DELETE /projects/:id

Delete a project and all associated logs. Irreversible.

---

### POST /projects/:id/rotate-key

Generate a new API key. Immediately invalidates the old one.

**Response `200`:**

```json
{ "id": "...", "name": "My App", "apiKey": "ls_newkey..." }
```

---

### GET /projects/:id/logs

Query logs for a project (JWT auth, for the dashboard).

See [Log Query Parameters](#log-query-parameters).

---

## Log Ingestion

### POST /logs

Ingest a batch of logs. Requires API key auth (`Bearer ls_...`).

**Request:**

```json
{
  "logs": [
    {
      "level": "error",
      "message": "Database connection failed",
      "source": "api-server",
      "metadata": { "host": "db.example.com", "attempt": 3 }
    },
    {
      "level": "info",
      "message": "User logged in",
      "metadata": { "userId": "user_123" }
    }
  ]
}
```

Valid levels: `debug`, `info`, `warn`, `error`, `critical`, `fatal`

**Response `201`:**

```json
{
  "message": "Logs ingested successfully",
  "count": 2,
  "persisted": true
}
```

> Logs are persisted and queryable for **all** project environments
> (development, staging, production). Usage is only metered for production
> projects.

**Errors:** `400 VALIDATION_ERROR`, `401 INVALID_API_KEY`, `429 USAGE_LIMIT_EXCEEDED`

**Limits:** Max 1000 logs per request.

---

### GET /logs

Query logs. Requires API key auth.

**Query Parameters:** See [Log Query Parameters](#log-query-parameters).

---

### GET /logs/:id

Get a single log by ID. Requires `?projectId=<uuid>`.

---

## Log Query Parameters

| Parameter   | Type   | Required | Description                                 |
| ----------- | ------ | -------- | ------------------------------------------- |
| `offset`    | number | No       | Pagination offset (default: 0)              |
| `limit`     | number | No       | Results per page (default: 50, max: 1000)   |
| `level`     | string | No       | Filter: `info`, `warn`, `error`, `critical` |
| `search`    | string | No       | Full-text search in message                 |
| `startTime` | string | No       | ISO 8601 timestamp                          |
| `endTime`   | string | No       | ISO 8601 timestamp                          |

**Response:**

```json
{
  "logs": [
    {
      "id": 12345,
      "projectId": "550e8400-...",
      "level": "error",
      "message": "Database connection failed",
      "metadata": { "host": "db.example.com" },
      "source": "api-server",
      "createdAt": "2026-01-15T10:30:00Z"
    }
  ],
  "total": 1543,
  "offset": 0,
  "hasMore": true
}
```

---

## Alerts

All alert endpoints require JWT auth.

### GET /alerts?projectId=:uuid

List alert rules for a project.

**Response `200`:**

```json
[
  {
    "id": 1,
    "projectId": "550e8400-...",
    "name": "Critical Errors",
    "triggerPattern": "database.*connection",
    "triggerLevel": "error",
    "channel": "email",
    "recipient": "alerts@example.com",
    "cooldownMinutes": 15,
    "enabled": true,
    "createdAt": "2026-01-15T10:30:00Z"
  }
]
```

---

### POST /alerts?projectId=:uuid

Create an alert rule.

**Request:**

```json
{
  "name": "Critical Errors",
  "triggerPattern": "database.*connection",
  "triggerLevel": "error",
  "channel": "email",
  "recipient": "alerts@example.com",
  "cooldownMinutes": 15,
  "enabled": true
}
```

- `triggerPattern`: Regex pattern matched against log messages
- `triggerLevel`: Optional — if set, only logs at this level are checked
- `channel`: `email` | `push` | `webhook`
- `recipient`: Email address, user ID (for push), or webhook URL

> A rule with only `triggerLevel` (no pattern) will fire for every log at that level.

---

### PUT /alerts/:id

Update an alert rule.

---

### DELETE /alerts/:id

Delete an alert rule.

---

### GET /alerts/:id/history

Get the trigger history for an alert rule.

**Response `200`:**

```json
{
  "history": [
    {
      "id": 1,
      "alertRuleId": 1,
      "logId": 12345,
      "sentAt": "2026-01-15T10:30:00Z",
      "status": "success",
      "errorMessage": null
    }
  ]
}
```

---

## Billing

All billing endpoints require JWT auth.

### GET /billing/pricing

Get available pricing tiers. No auth required.

### GET /billing/subscription

Get the current user's subscription.

### GET /billing/usage

Get current month's usage.

### POST /billing/initialize

Initialize a Paystack payment.

**Request:**

```json
{
  "tier": "pro",
  "currency": "USD",
  "callbackUrl": "https://app.example.com/billing?success=true"
}
```

**Response `200`:**

```json
{
  "authorizationUrl": "https://checkout.paystack.com/...",
  "reference": "ref_abc123",
  "accessCode": "abc123"
}
```

### GET /billing/transactions

Get transaction history.

### POST /billing/cancel

Cancel the current subscription.

---

## Organizations

All organization endpoints require JWT auth.

### GET /organizations/me

Get the current user's organization with members.

### GET /organizations/:id/members

List organization members.

### POST /organizations/:id/members

Invite a member by email.

**Request:** `{ "email": "colleague@example.com", "role": "member" }`

Roles: `admin` | `member` | `viewer`

### PATCH /organizations/:id/members/:memberId

Update a member's role.

### DELETE /organizations/:id/members/:memberId

Remove a member.

---

## Audit Logs

All audit endpoints require JWT auth.

### GET /audit

Get audit logs for the organization.

**Query Parameters:** `action` (filter), `page`, `per_page`

### GET /audit/actions

Get the list of available audit action types.

### GET /audit/:resource_type/:resource_id

Get audit logs for a specific resource.

---

## Users

All user endpoints require JWT auth.

### GET /users/me

Get the current user's profile.

### PUT /users/me

Update name.

**Request:** `{ "name": "New Name" }`

### PUT /users/me/password

Change password.

**Request:** `{ "currentPassword": "old", "newPassword": "new" }`

### POST /users/me/logout-all

Invalidate all active sessions.

---

## Mobile

### POST /mobile/push-token

Register a device push token. Requires JWT auth.

**Request:** `{ "token": "fcm-token", "platform": "ios" }`

### DELETE /mobile/push-token

Remove a push token. Requires JWT auth.

### GET /stream

WebSocket endpoint for real-time log streaming (web dashboard and other clients).

**URL:** `ws://localhost:8080/v1/stream?projectId=<uuid>`

**Auth:** the JWT may be supplied as `Authorization: Bearer <token>` (native
clients) or — since browsers cannot set that header on a WebSocket — via the
`Sec-WebSocket-Protocol` header (the subprotocol array) or a `?token=<jwt>`
query parameter.

### GET /mobile/stream

Same real-time stream, kept under the `/mobile` namespace for native mobile
clients. Requires JWT auth via the `Authorization` header.

**URL:** `ws://localhost:8080/v1/mobile/stream?projectId=<uuid>`

**Incoming message:**

```json
{
  "id": 12345,
  "projectId": "550e8400-...",
  "level": "error",
  "message": "Something went wrong",
  "source": "api",
  "createdAt": "2026-01-15T10:30:00Z"
}
```

---

## Admin

All admin endpoints require JWT auth and `role: "admin"`.

### GET /admin/stats

System-wide statistics.

**Response `200`:**

```json
{
  "totalUsers": 1543,
  "totalProjects": 3287,
  "totalLogs": 45234567
}
```

### GET /admin/users

List all users.

### GET /admin/projects

List all projects.

---

## Health

### GET /health

Basic health check. No auth required.

### GET /ready

Readiness check — verifies database and Redis connectivity.

---

## Error Format

All errors follow this structure:

```json
{
  "code": "MACHINE_READABLE_CODE",
  "message": "Human-readable description"
}
```

**Common codes:**

| Code                   | HTTP | Description                   |
| ---------------------- | ---- | ----------------------------- |
| `VALIDATION_ERROR`     | 400  | Invalid request body          |
| `INVALID_CREDENTIALS`  | 401  | Wrong email or password       |
| `INVALID_API_KEY`      | 401  | API key invalid or revoked    |
| `SESSION_EXPIRED`      | 401  | JWT expired, refresh required |
| `FORBIDDEN`            | 403  | Insufficient permissions      |
| `NOT_FOUND`            | 404  | Resource does not exist       |
| `EMAIL_EXISTS`         | 409  | Email already registered      |
| `USAGE_LIMIT_EXCEEDED` | 429  | Monthly log quota exceeded    |
| `RATE_LIMIT_EXCEEDED`  | 429  | Too many requests             |
| `INTERNAL_ERROR`       | 500  | Server error                  |

---

## Rate Limits

| Endpoint group      | Limit                    |
| ------------------- | ------------------------ |
| Auth endpoints      | 10 req/min per IP        |
| Log ingestion       | 1000 req/min per API key |
| All other endpoints | 100 req/min per IP       |

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1709568060
```
