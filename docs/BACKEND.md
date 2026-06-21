# Logstack Backend Documentation

**Version:** 1.0.0  
**Language:** Go 1.21+  
**Framework:** Gin Web Framework  
**Database:** PostgreSQL (via GORM ORM)  
**Cache:** Redis  
**Last Updated:** February 4, 2026

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Environment Configuration](#environment-configuration)
3. [Database Models](#database-models)
4. [API Endpoints](#api-endpoints)
5. [Authentication & Authorization](#authentication--authorization)
6. [Middleware](#middleware)
7. [Services](#services)
8. [Workers](#workers)
9. [WebSocket Integration](#websocket-integration)
10. [Usage Tracking & Billing](#usage-tracking--billing)
11. [Error Codes](#error-codes)
12. [Rate Limiting](#rate-limiting)
13. [Deployment](#deployment)

---

## Architecture Overview

### Technology Stack

- **Web Framework:** Gin (HTTP router)
- **ORM:** GORM v2 (PostgreSQL)
- **Caching:** Redis
- **Authentication:** JWT (HS256)
- **Real-time:** WebSocket + Redis Pub/Sub
- **Payments:** Paystack
- **Email:** Brevo (formerly Sendinblue)
- **Push Notifications:** Firebase Cloud Messaging (FCM)

### Project Structure

```
packages/logstack-go/
├── cmd/server/          # Application entry point
├── internal/
│   ├── api/
│   │   ├── handlers/    # HTTP request handlers
│   │   ├── middleware/  # HTTP middleware
│   │   └── router.go    # Route configuration
│   ├── config/          # Configuration management
│   ├── db/              # Database connections & migrations
│   ├── models/          # Data models
│   ├── services/        # Business logic
│   ├── websocket/       # WebSocket hub & clients
│   └── workers/         # Background workers
└── migrations/          # SQL migration files
```

---

## Environment Configuration

### Required Environment Variables

| Variable       | Description                           | Default     | Required |
| -------------- | ------------------------------------- | ----------- | -------- |
| `DATABASE_URL` | PostgreSQL connection string          | -           | ✅       |
| `REDIS_URL`    | Redis connection string               | -           | ✅       |
| `JWT_SECRET`   | Secret for JWT signing (min 32 chars) | -           | ✅       |
| `PORT`         | HTTP server port                      | 8080        | ❌       |
| `ENV`          | Environment (development/production)  | development | ❌       |

### Optional Variables

| Variable                   | Description                            | Default                                         |
| -------------------------- | -------------------------------------- | ----------------------------------------------- |
| `BREVO_API_KEY`            | Email service API key                  | -                                               |
| `FCM_SERVICE_ACCOUNT_PATH` | Path to FCM credentials JSON           | -                                               |
| `FCM_PROJECT_ID`           | Firebase project ID                    | -                                               |
| `PAYSTACK_SECRET_KEY`      | Paystack secret key                    | -                                               |
| `PAYSTACK_PUBLIC_KEY`      | Paystack public key                    | -                                               |
| `BASE_URL`                 | Frontend application URL               | http://localhost:3000                           |
| `ALLOWED_ORIGINS`          | CORS allowed origins (comma-separated) | https://logstack.tech,https://www.logstack.tech |
| `ACCESS_TOKEN_EXPIRY`      | JWT access token duration              | 15m                                             |
| `REFRESH_TOKEN_EXPIRY`     | JWT refresh token duration             | 7d                                              |
| `RATE_LIMIT_REQUESTS`      | Rate limit per window                  | 100                                             |
| `RATE_LIMIT_WINDOW`        | Rate limit window duration             | 1m                                              |
| `USAGE_SYNC_INTERVAL`      | Usage sync frequency                   | 1m                                              |

### Configuration Loading

Configuration is loaded via `internal/config/config.go`:

```go
cfg, err := config.Load()
```

**Validation:** In production mode, JWT_SECRET must be at least 32 characters.

---

## Database Models

### Core Models

#### User

```go
type User struct {
    ID                 uint       `json:"id"`
    Email              string     `json:"email"`
    PasswordHash       string     `json:"-"`
    Name               string     `json:"name"`
    Role               string     `json:"role"` // "user" | "admin"
    EmailVerified      bool       `json:"emailVerified"`
    VerificationToken  *string    `json:"-"`
    VerificationSentAt *time.Time `json:"-"`
    CreatedAt          time.Time  `json:"createdAt"`
    UpdatedAt          time.Time  `json:"updatedAt"`
}
```

**Indexes:**

- `email` (unique)

**Methods:**

- `SetPassword(password string)` - Hash and set password
- `CheckPassword(password string) bool` - Verify password
- `GenerateVerificationToken()` - Create email verification token
- `IsVerificationTokenValid() bool` - Check token expiry (24h)

---

#### Project

```go
type Project struct {
    ID             uuid.UUID  `json:"id"`
    Name           string     `json:"name"`
    OwnerID        uint       `json:"ownerId"`
    OrganizationID *uuid.UUID `json:"organizationId"`
    APIKey         string     `json:"-"`
    CreatedAt      time.Time  `json:"createdAt"`
}
```

**Indexes:**

- `api_key` (unique)
- `owner_id`
- `organization_id`

**API Key Format:** `ls_` + 64 hex characters

---

#### Log

```go
type Log struct {
    ID        int64           `json:"id"`
    ProjectID uuid.UUID       `json:"projectId"`
    Level     LogLevel        `json:"level"` // info|warn|error|critical
    Message   string          `json:"message"`
    Metadata  json.RawMessage `json:"metadata,omitempty"`
    Source    string          `json:"source,omitempty"`
    CreatedAt time.Time       `json:"createdAt"`
}
```

**Indexes:**

- `project_id` + `created_at` (composite)
- `level`

**Constraints:**

- Max batch size: 1000 logs per request
- Message: text field (unlimited)
- Metadata: JSONB for efficient querying

---

#### Organization

```go
type Organization struct {
    ID        uuid.UUID `json:"id"`
    Name      string    `json:"name"`
    Slug      string    `json:"slug"`
    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
}
```

**OrganizationMember:**

```go
type OrganizationMember struct {
    ID             uuid.UUID `json:"id"`
    OrganizationID uuid.UUID `json:"organizationId"`
    UserID         uint      `json:"userId"`
    Role           string    `json:"role"` // owner|admin|member|viewer
    CreatedAt      time.Time `json:"createdAt"`
    UpdatedAt      time.Time `json:"updatedAt"`
}
```

**Indexes:**

- `slug` (unique)
- `organization_id` + `user_id` (unique composite)

**Roles:**

- `owner` - Full control (cannot be removed)
- `admin` - Invite/remove members, manage projects
- `member` - Create/edit projects
- `viewer` - Read-only access

---

#### Subscription

```go
type Subscription struct {
    ID                       uint               `json:"id"`
    UserID                   uint               `json:"userId"`
    OrganizationID           *uuid.UUID         `json:"organizationId"`
    Tier                     SubscriptionTier   `json:"tier"`
    Status                   SubscriptionStatus `json:"status"`
    PaystackCustomerCode     *string            `json:"paystackCustomerCode,omitempty"`
    PaystackSubscriptionCode *string            `json:"paystackSubscriptionCode,omitempty"`
    Currency                 string             `json:"currency"` // USD|NGN|GHS
    AmountCents              int                `json:"amountCents"`
    PeriodStart              *time.Time         `json:"periodStart,omitempty"`
    PeriodEnd                *time.Time         `json:"periodEnd,omitempty"`
    CreatedAt                time.Time          `json:"createdAt"`
    UpdatedAt                time.Time          `json:"updatedAt"`
}
```

**Tiers:**

- `free` - 10K logs/month, 1 team member, $0
- `starter` - 500K logs/month, 3 team members, $15/month
- `pro` - 5M logs/month, 10 team members, $49/month
- `enterprise` - Unlimited logs, unlimited team members, custom pricing

**Statuses:**

- `active` - Can use service
- `trialing` - Can use service (trial period)
- `past_due` - Payment failed, grace period
- `cancelled` - Subscription ended
- `paused` - Temporarily disabled

---

#### AlertRule

```go
type AlertRule struct {
    ID              uint         `json:"id"`
    ProjectID       uuid.UUID    `json:"projectId"`
    Name            string       `json:"name"`
    TriggerPattern  string       `json:"triggerPattern"` // Regex pattern
    TriggerLevel    LogLevel     `json:"triggerLevel,omitempty"`
    Channel         AlertChannel `json:"channel"` // email|push|webhook
    Recipient       string       `json:"recipient"` // Email/webhook URL
    CooldownMinutes int          `json:"cooldownMinutes"` // Default: 15
    Enabled         bool         `json:"enabled"`
    CreatedAt       time.Time    `json:"createdAt"`
    UpdatedAt       time.Time    `json:"updatedAt"`
}
```

**Channels:**

- `email` - Send email alert
- `push` - Send mobile push notification
- `webhook` - HTTP POST to URL

**Cooldown:** Prevents alert spam by enforcing minimum time between alerts for the same rule.

---

#### AuditLog

```go
type AuditLog struct {
    ID             uuid.UUID       `json:"id"`
    OrganizationID uuid.UUID       `json:"organization_id"`
    UserID         uint            `json:"user_id"`
    Action         string          `json:"action"`
    ResourceType   string          `json:"resource_type"`
    ResourceID     string          `json:"resource_id,omitempty"`
    Details        AuditLogDetails `json:"details,omitempty"` // JSONB
    IPAddress      string          `json:"ip_address,omitempty"`
    UserAgent      string          `json:"user_agent,omitempty"`
    CreatedAt      time.Time       `json:"created_at"`
}
```

**Common Actions:**

- `member.invited`, `member.removed`, `member.role_changed`
- `project.created`, `project.updated`, `project.deleted`
- `subscription.upgraded`, `subscription.cancelled`
- `api_key.created`, `api_key.revoked`

**Indexes:**

- `organization_id`
- `user_id`
- `action`
- `resource_type` + `resource_id` (composite)
- `created_at` (DESC for recent-first queries)

---

## API Endpoints

### Base URL

- **Production:** `https://api.logstack.tech/v1`
- **Development:** `http://localhost:8080/v1`

### Authentication Endpoints

#### POST `/v1/auth/signup`

Register a new user account.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securepass123",
  "name": "John Doe"
}
```

**Response:** `201 Created`

```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": false,
    "createdAt": "2026-02-04T10:00:00Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

**Errors:**

- `409 EMAIL_EXISTS` - Email already registered
- `400 VALIDATION_ERROR` - Invalid input

**Side Effects:**

- Creates default organization for user
- Sends verification email (async)
- Creates free tier subscription

---

#### POST `/v1/auth/login`

Authenticate user and get tokens.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securepass123"
}
```

**Response:** `200 OK`

```json
{
  "user": { ... },
  "tokens": { ... }
}
```

**Errors:**

- `401 INVALID_CREDENTIALS` - Wrong email/password

---

#### POST `/v1/auth/refresh`

Refresh access token using refresh token.

**Request:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:** `200 OK`

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900
}
```

---

#### POST `/v1/auth/logout`

Invalidate current access token.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`

**Side Effect:** Blacklists token in Redis (until expiry)

---

#### POST `/v1/auth/forgot-password`

Request password reset email.

**Request:**

```json
{
  "email": "user@example.com"
}
```

**Response:** `200 OK` (always, to prevent email enumeration)

---

#### POST `/v1/auth/reset-password`

Reset password using token from email.

**Request:**

```json
{
  "token": "abc123...",
  "password": "newpassword123"
}
```

**Response:** `200 OK`

---

#### GET `/v1/auth/verify-email?token=abc123`

Verify email address.

**Response:** `200 OK` or `400 INVALID_TOKEN`

---

### Project Endpoints

#### GET `/v1/projects`

List user's projects.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Project",
    "ownerId": 1,
    "createdAt": "2026-02-04T10:00:00Z"
  }
]
```

---

#### POST `/v1/projects`

Create new project.

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "name": "My New Project"
}
```

**Response:** `201 Created`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My New Project",
  "ownerId": 1,
  "apiKey": "ls_a1b2c3d4e5f6...",
  "createdAt": "2026-02-04T10:00:00Z"
}
```

**Note:** API key is only returned on creation. Store it securely.

---

#### GET `/v1/projects/:id`

Get project details.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`

---

#### PUT `/v1/projects/:id`

Update project name.

**Request:**

```json
{
  "name": "Updated Project Name"
}
```

**Response:** `200 OK`

---

#### DELETE `/v1/projects/:id`

Delete project and all associated logs.

**Response:** `200 OK`

**Warning:** This action is irreversible.

---

#### POST `/v1/projects/:id/rotate-key`

Generate new API key (invalidates old one).

**Response:** `200 OK`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Project",
  "apiKey": "ls_new_key_here..."
}
```

---

### Log Ingestion Endpoints

#### POST `/v1/logs`

Ingest batch of logs.

**Headers:**

- `Authorization: Bearer ls_<api_key>`
- `Content-Type: application/json`

**Request:**

```json
{
  "logs": [
    {
      "level": "error",
      "message": "Database connection failed",
      "metadata": {
        "error": "ECONNREFUSED",
        "host": "localhost:5432",
        "attempt": 3
      },
      "source": "api-server"
    },
    {
      "level": "info",
      "message": "User logged in",
      "metadata": {
        "userId": 123,
        "ip": "192.168.1.1"
      }
    }
  ]
}
```

**Response:** `201 Created`

```json
{
  "message": "Logs ingested successfully",
  "count": 2
}
```

**Headers (Response):**

- `X-RateLimit-Limit: 10000`
- `X-RateLimit-Remaining: 9998`
- `X-RateLimit-Reset: 1709568000`

**Errors:**

- `400 VALIDATION_ERROR` - Invalid log format
- `401 INVALID_API_KEY` - API key invalid/revoked
- `429 USAGE_LIMIT_EXCEEDED` - Monthly log quota exceeded

**Constraints:**

- Max batch size: 1000 logs
- Max message length: unlimited (text field)
- Valid levels: `info`, `warn`, `error`, `critical`

---

#### GET `/v1/logs`

Query logs (API key auth).

**Headers:** `Authorization: Bearer ls_<api_key>`

**Query Parameters:**

- `projectId` (required) - UUID
- `offset` (default: 0)
- `limit` (default: 50, max: 1000)
- `level` - Filter by level
- `search` - Full-text search in message
- `startTime` - ISO 8601 timestamp
- `endTime` - ISO 8601 timestamp

**Response:** `200 OK`

```json
{
  "logs": [
    {
      "id": 12345,
      "projectId": "550e8400-e29b-41d4-a716-446655440000",
      "level": "error",
      "message": "Database connection failed",
      "metadata": { "error": "ECONNREFUSED" },
      "source": "api-server",
      "createdAt": "2026-02-04T10:30:00Z"
    }
  ],
  "total": 1543,
  "offset": 0,
  "hasMore": true
}
```

---

#### GET `/v1/logs/:id`

Get single log by ID.

**Query Parameters:** `projectId` (required)

**Response:** `200 OK`

---

#### GET `/v1/projects/:id/logs`

Query logs (JWT auth, for dashboard).

**Headers:** `Authorization: Bearer <jwt>`

**Query Parameters:** Same as `/v1/logs`

**Response:** Same as `/v1/logs`

---

### Alert Endpoints

#### GET `/v1/alerts`

List alert rules for user's projects.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "projectId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Critical Errors",
    "triggerPattern": "database.*connection",
    "triggerLevel": "error",
    "channel": "email",
    "recipient": "alerts@example.com",
    "cooldownMinutes": 15,
    "enabled": true,
    "createdAt": "2026-02-04T10:00:00Z"
  }
]
```

---

#### POST `/v1/alerts`

Create alert rule.

**Request:**

```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Critical Errors",
  "triggerPattern": "database.*connection",
  "triggerLevel": "error",
  "channel": "email",
  "recipient": "alerts@example.com",
  "cooldownMinutes": 15,
  "enabled": true
}
```

**Response:** `201 Created`

**Validation:**

- `triggerPattern` must be valid regex
- `channel` must be: `email`, `push`, or `webhook`
- `cooldownMinutes` >= 0

---

#### GET `/v1/alerts/:id/history`

Get alert trigger history.

**Response:** `200 OK`

```json
{
  "history": [
    {
      "id": "uuid",
      "alertRuleId": 1,
      "logId": 12345,
      "triggeredAt": "2026-02-04T10:30:00Z",
      "notificationSent": true
    }
  ]
}
```

---

### Organization Endpoints

#### GET `/v1/organizations/me`

Get current user's organization.

**Response:** `200 OK`

```json
{
  "id": "uuid",
  "name": "My Company",
  "slug": "my-company",
  "members": [
    {
      "id": "member-uuid",
      "userId": 1,
      "role": "owner",
      "user": {
        "id": 1,
        "email": "owner@example.com",
        "name": "John Doe"
      },
      "createdAt": "2026-02-04T10:00:00Z"
    }
  ]
}
```

---

#### POST `/v1/organizations/:id/members`

Invite member to organization.

**Request:**

```json
{
  "email": "newmember@example.com",
  "role": "member"
}
```

**Response:** `201 Created`

**Errors:**

- `402 MEMBER_LIMIT_EXCEEDED` - Upgrade plan required
- `403 INSUFFICIENT_PERMISSIONS` - Only owner/admin
- `409 ALREADY_MEMBER` - User already in organization

**Side Effect:** Creates audit log entry

---

#### PATCH `/v1/organizations/:id/members/:memberId`

Update member role.

**Request:**

```json
{
  "role": "admin"
}
```

**Response:** `200 OK`

**Rules:**

- Only owner/admin can change roles
- Cannot change owner role
- Cannot demote yourself

---

#### DELETE `/v1/organizations/:id/members/:memberId`

Remove member from organization.

**Response:** `200 OK`

**Rules:**

- Only owner/admin can remove
- Cannot remove owner
- Cannot remove yourself

---

### Billing Endpoints

#### GET `/v1/billing/pricing`

Get pricing tiers (public, no auth).

**Response:** `200 OK`

```json
{
  "tiers": [
    {
      "tier": "free",
      "name": "Free",
      "logLimit": 10000,
      "teamMembers": 1,
      "prices": {
        "USD": 0,
        "NGN": 0,
        "GHS": 0
      },
      "features": [
        "10K logs/month",
        "1 team member",
        "Email support"
      ]
    }
  ],
  "currencies": [...]
}
```

---

#### GET `/v1/billing/subscription`

Get user's current subscription.

**Response:** `200 OK`

```json
{
  "id": 1,
  "userId": 1,
  "tier": "pro",
  "status": "active",
  "currency": "USD",
  "amountCents": 4900,
  "logLimit": 5000000,
  "periodStart": "2026-02-01T00:00:00Z",
  "periodEnd": "2026-03-01T00:00:00Z",
  "createdAt": "2026-02-01T00:00:00Z"
}
```

---

#### GET `/v1/billing/usage`

Get current month's usage.

**Response:** `200 OK`

```json
{
  "userId": 1,
  "tier": "pro",
  "logLimit": 5000000,
  "logsUsed": 234567,
  "bytesUsed": 12345678,
  "percentUsed": 4.69,
  "isOverLimit": false,
  "periodStart": "2026-02-01T00:00:00Z",
  "periodEnd": "2026-03-01T00:00:00Z"
}
```

---

#### POST `/v1/billing/initialize`

Initialize payment (Paystack).

**Request:**

```json
{
  "tier": "pro",
  "currency": "USD",
  "callbackUrl": "https://app.example.com/billing/success"
}
```

**Response:** `200 OK`

```json
{
  "authorizationUrl": "https://checkout.paystack.com/...",
  "accessCode": "abc123...",
  "reference": "ref_abc123..."
}
```

**Errors:**

- `503 SERVICE_UNAVAILABLE` - Paystack not configured

---

#### GET `/v1/billing/transactions`

Get transaction history.

**Response:** `200 OK`

```json
{
  "transactions": [
    {
      "id": 123,
      "reference": "ref_abc123",
      "amount": 4900,
      "currency": "USD",
      "status": "success",
      "paidAt": "2026-02-01T10:00:00Z"
    }
  ],
  "meta": {
    "total": 5,
    "page": 1
  }
}
```

---

#### POST `/v1/billing/cancel`

Cancel subscription.

**Response:** `200 OK`

**Effect:** Downgrades to free tier at period end.

---

### Audit Log Endpoints

#### GET `/v1/audit`

Get audit logs for organization.

**Query Parameters:**

- `action` - Filter by action (e.g., `member.invited`)
- `offset` (default: 0)
- `limit` (default: 20, max: 100)

**Response:** `200 OK`

```json
{
  "logs": [
    {
      "id": "uuid",
      "action": "member.invited",
      "resourceType": "member",
      "resourceId": "member-uuid",
      "details": {
        "email": "newmember@example.com",
        "role": "member"
      },
      "user": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com"
      },
      "ipAddress": "192.168.1.1",
      "createdAt": "2026-02-04T10:00:00Z"
    }
  ],
  "total": 45
}
```

---

#### GET `/v1/audit/actions`

Get list of available audit actions.

**Response:** `200 OK`

```json
{
  "actions": [
    "member.invited",
    "member.removed",
    "member.role_changed",
    "project.created",
    "subscription.upgraded"
  ]
}
```

---

### Admin Endpoints

#### GET `/v1/admin/stats`

System-wide statistics (admin only).

**Response:** `200 OK`

```json
{
  "totalUsers": 1543,
  "totalProjects": 3287,
  "totalLogs": 45234567,
  "activeSubscriptions": 234
}
```

---

#### GET `/v1/admin/users`

List all users (admin only).

**Query Parameters:**

- `offset`, `limit`
- `search` - Filter by email/name

**Response:** `200 OK`

---

### Health Check Endpoints

#### GET `/health`

Basic health check.

**Response:** `200 OK`

```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "timestamp": "2026-02-04T10:00:00Z"
}
```

---

#### GET `/ready`

Readiness check (Kubernetes).

**Response:** `200 OK` if all dependencies ready, `503 Service Unavailable` otherwise.

---

## Authentication & Authorization

### JWT Authentication

**Access Token:**

- Expiry: 15 minutes (configurable)
- Algorithm: HS256
- Claims: `userID`, `email`, `exp`, `iat`

**Refresh Token:**

- Expiry: 7 days (configurable)
- Stored in Redis for revocation
- Used to obtain new access token

**Token Format:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token Blacklisting:**

- On logout, token added to Redis blacklist
- TTL matches token expiry
- Checked on each authenticated request

---

### API Key Authentication

**Format:** `ls_` prefix + 64 hex characters

**Usage:**

```
Authorization: Bearer ls_a1b2c3d4e5f6...
```

**Validation:**

1. Extract key from header
2. Lookup project in database
3. Set `projectID` in request context

**Security:**

- Keys stored as plain text (for lookup)
- Rotating key invalidates old one immediately
- No key expiry (manual rotation required)

---

### Role-Based Access Control (RBAC)

**Organization Roles:**

- `owner` - Full access, cannot be removed
- `admin` - Manage members, create projects
- `member` - Create/edit own projects
- `viewer` - Read-only access

**Permission Matrix:**

| Action         | Owner | Admin | Member   | Viewer |
| -------------- | ----- | ----- | -------- | ------ |
| Invite member  | ✅    | ✅    | ❌       | ❌     |
| Remove member  | ✅    | ✅    | ❌       | ❌     |
| Change roles   | ✅    | ✅    | ❌       | ❌     |
| Create project | ✅    | ✅    | ✅       | ❌     |
| Delete project | ✅    | ✅    | ✅ (own) | ❌     |
| View logs      | ✅    | ✅    | ✅       | ✅     |
| Manage billing | ✅    | ❌    | ❌       | ❌     |

---

## Middleware

### Global Middleware (All Routes)

1. **gin.Recovery()** - Panic recovery
2. **CORS** - Cross-origin requests
3. **RequestID** - Unique request identifier
4. **Logger** - Structured request logging
5. **RateLimiter** - Global rate limiting (100 req/min)

---

### Auth Middleware

#### JWTAuth

- Validates JWT token from `Authorization` header
- Sets `userID`, `userEmail`, `token` in context
- Returns `401 Unauthorized` on failure

**Usage:**

```go
protected.Use(middleware.JWTAuth(authService))
```

---

#### APIKeyAuth

- Validates API key from `Authorization` header
- Looks up project in database
- Sets `projectID`, `project` in context
- Returns `401 INVALID_API_KEY` on failure

**Usage:**

```go
logs.Use(middleware.APIKeyAuth(db))
```

---

### Rate Limiting Middleware

#### Global Limiter

- 100 requests per minute per IP
- Sliding window algorithm
- Stored in Redis

#### Auth Limiter

- 10 requests per minute per IP
- Applied to `/auth/*` endpoints
- Prevents brute force attacks

#### Ingest Limiter

- 1000 requests per minute per API key
- Applied to `/logs` endpoint
- Counted by API key

**Headers:**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1709568060
Retry-After: 60
```

---

### Usage Limit Middleware

- Enforces tier-based monthly log quotas
- Checks Redis for current usage
- Fallback to PostgreSQL if Redis unavailable
- Returns `429 USAGE_LIMIT_EXCEEDED` when over limit

**Response Headers:**

```
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 5432
X-RateLimit-Reset: 1709596800
```

**Error Response:**

```json
{
  "error": "monthly log limit exceeded",
  "code": "USAGE_LIMIT_EXCEEDED",
  "currentUsage": 10523,
  "limit": 10000,
  "tier": "free",
  "upgradeUrl": "/dashboard/billing",
  "message": "You have used 10523 of 10000 logs this month..."
}
```

---

### Admin Middleware

- Requires JWT authentication
- Checks `user.role == "admin"`
- Returns `403 Forbidden` for non-admins

---

### Project Owner Middleware

- Requires JWT authentication
- Verifies user owns the project
- Returns `404 Not Found` if not owner

---

## Services

### AuthService

**Responsibilities:**

- JWT token generation/validation
- Token blacklisting (logout)
- Password reset tokens

**Key Methods:**

```go
GenerateTokens(user *models.User) (*TokenPair, error)
ValidateToken(token string) (*Claims, error)
BlacklistToken(ctx context.Context, token string) error
IsTokenBlacklisted(ctx context.Context, token string) bool
```

---

### Ingestor

**Responsibilities:**

- Validate and save log batches
- Track usage in Redis
- Publish logs to Redis Pub/Sub

**Key Methods:**

```go
IngestBatch(ctx, projectID, logs) ([]Log, error)
IngestSingle(ctx, projectID, logReq) (*Log, error)
```

**Features:**

- Bulk insert with batching (100 logs/batch)
- Transaction support
- Async usage tracking
- Real-time broadcasting

---

### QueryBuilder

**Responsibilities:**

- Efficient log querying
- Filter by level, time range, search text
- Pagination

**Key Methods:**

```go
Query(opts QueryOptions) (*LogQueryResponse, error)
GetByID(logID, projectID) (*Log, error)
```

**Optimizations:**

- Composite index on `project_id + created_at`
- Full-text search on message
- JSONB queries on metadata

---

### AlertEngine

**Responsibilities:**

- Evaluate logs against alert rules
- Trigger notifications (email/push/webhook)
- Enforce cooldown periods

**Key Methods:**

```go
EvaluateLog(log *models.Log) error
CreateAlertRule(rule *models.AlertRule) error
GetAlertHistory(ruleID) ([]AlertHistory, error)
```

**Features:**

- Regex pattern matching
- Redis-based cooldown tracking
- Async notification sending

---

### BillingService

**Responsibilities:**

- Paystack integration
- Subscription management
- Transaction history

**Key Methods:**

```go
InitializePayment(ctx, userID, req) (*InitPaymentResponse, error)
GetSubscription(ctx, userID) (*Subscription, error)
GetTransactionHistory(ctx, customerCode) (*TxResponse, error)
HandleWebhook(ctx, payload) error
```

**Webhook Events:**

- `subscription.create` - New subscription
- `subscription.not_renew` - Cancellation
- `invoice.payment_failed` - Payment issue

---

### OrganizationService

**Responsibilities:**

- Team member management
- Role-based permissions
- Tier-based seat limits

**Key Methods:**

```go
GetUserOrganization(ctx, userID) (*OrgResponse, error)
InviteMember(ctx, orgID, inviterID, email, role) (*Member, error)
RemoveMember(ctx, orgID, actorID, memberID) error
UpdateMemberRole(ctx, orgID, actorID, memberID, role) error
```

**Business Rules:**

- Free: 1 member max
- Starter: 3 members max
- Pro: 10 members max
- Enterprise: Unlimited

**Audit Logging:** All actions logged automatically.

---

### AuditService

**Responsibilities:**

- Record audit trail
- Query audit logs
- Filter by action/resource/user

**Key Methods:**

```go
CreateAuditLog(ctx, log *AuditLog) error
GetOrganizationAuditLogs(ctx, orgID, opts) ([]AuditLog, int64, error)
GetAuditLogsByAction(ctx, orgID, action, opts) ([]AuditLog, error)
GetAvailableActions() []string
```

---

### NotificationService

**Responsibilities:**

- Email notifications (Brevo)
- Push notifications (FCM)
- Templated emails

**Email Templates:**

- Verification email
- Password reset
- Usage warning (80%)
- Usage critical (100%)
- Alert notifications

**Key Methods:**

```go
SendVerificationEmail(ctx, email, name, token) error
SendPasswordResetEmail(ctx, email, name, token) error
SendUsageWarningEmail(ctx, user, usage) error
SendAlertEmail(ctx, email, alert, log) error
```

---

## Workers

### AlertProcessor

**Schedule:** Continuous (runs in background)

**Responsibilities:**

- Monitor new logs in real-time
- Evaluate against alert rules
- Trigger notifications

**Workflow:**

1. Subscribe to Redis Pub/Sub channels
2. Receive log events
3. Fetch alert rules for project
4. Match patterns and levels
5. Check cooldown
6. Send notifications

---

### UsageSyncWorker

**Schedule:** Every 1 minute (configurable)

**Responsibilities:**

- Sync Redis usage counters to PostgreSQL
- Calculate usage percentages
- Trigger usage threshold emails

**Workflow:**

1. Fetch all subscriptions
2. Read Redis counters
3. Update `usage_logs` table
4. Check 80% and 100% thresholds
5. Send emails with 24h cooldown

**Redis Keys:**

```
usage:logs:{userID}:{YYYY-MM}
usage:bytes:{userID}:{YYYY-MM}
```

---

### LogAggregator

**Schedule:** Every 5 minutes (configurable)

**Responsibilities:**

- Pre-calculate log statistics
- Generate daily/hourly aggregates
- Improve dashboard performance

**Future Enhancement:** Currently not implemented.

---

## WebSocket Integration

### Architecture

**Components:**

- Hub: Central message broadcaster
- Clients: Individual WebSocket connections
- Broadcaster: Redis Pub/Sub to WebSocket bridge

### Flow

1. Client connects: `ws://localhost:8080/ws?projectId=<uuid>`
2. Hub registers client in `projectID` group
3. Log ingested → published to Redis: `logs:<projectID>`
4. Broadcaster receives Redis message
5. Broadcaster sends to all clients in group
6. Client receives real-time log update

### Client Example (JavaScript)

```javascript
const ws = new WebSocket(
  "ws://localhost:8080/ws?projectId=550e8400-e29b-41d4-a716-446655440000",
);

ws.onmessage = (event) => {
  const log = JSON.parse(event.data);
  console.log("New log:", log);
};
```

---

## Usage Tracking & Billing

### Tier-Based Limits

| Tier       | Logs/Month | Team Members | Price  |
| ---------- | ---------- | ------------ | ------ |
| Free       | 10,000     | 1            | $0     |
| Starter    | 500,000    | 3            | $15    |
| Pro        | 5,000,000  | 10           | $49    |
| Enterprise | Unlimited  | Unlimited    | Custom |

### Usage Tracking Flow

1. **Ingest:** Log batch saved to PostgreSQL
2. **Count:** Increment Redis counter: `usage:logs:{userID}:{YYYY-MM}`
3. **Sync:** UsageSyncWorker reads Redis every minute
4. **Store:** Save to `usage_logs` table
5. **Check:** Enforce limits on next request

### Email Notifications

**80% Threshold:**

- Subject: "Usage Warning: 80% of Monthly Logs Used"
- CTA: "View Usage Dashboard"
- Cooldown: 24 hours

**100% Threshold:**

- Subject: "Critical: Monthly Log Limit Reached"
- CTA: "Upgrade Plan Now"
- Cooldown: 24 hours

**Cooldown Implementation:**

- Redis key: `usage:email_sent:{userID}:80` (or `:100`)
- TTL: 24 hours
- Prevents spam

---

## Error Codes

### Authentication Errors

| Code                  | HTTP | Description              |
| --------------------- | ---- | ------------------------ |
| `MISSING_TOKEN`       | 401  | No Authorization header  |
| `INVALID_FORMAT`      | 401  | Wrong header format      |
| `INVALID_TOKEN`       | 401  | Token invalid/expired    |
| `TOKEN_REVOKED`       | 401  | Token blacklisted        |
| `EMAIL_EXISTS`        | 409  | Email already registered |
| `INVALID_CREDENTIALS` | 401  | Wrong email/password     |

### Validation Errors

| Code                 | HTTP | Description               |
| -------------------- | ---- | ------------------------- |
| `VALIDATION_ERROR`   | 400  | Request validation failed |
| `INVALID_PROJECT_ID` | 400  | Project ID format invalid |
| `MISSING_PROJECT_ID` | 400  | Project ID required       |
| `EMPTY_BATCH`        | 400  | No logs in batch          |

### Authorization Errors

| Code                       | HTTP | Description                     |
| -------------------------- | ---- | ------------------------------- |
| `INSUFFICIENT_PERMISSIONS` | 403  | Insufficient role permissions   |
| `PROJECT_NOT_FOUND`        | 404  | Project doesn't exist/no access |

### Resource Errors

| Code               | HTTP | Description                  |
| ------------------ | ---- | ---------------------------- |
| `NOT_FOUND`        | 404  | Resource not found           |
| `ALREADY_MEMBER`   | 409  | User already in organization |
| `MEMBER_NOT_FOUND` | 404  | Member doesn't exist         |

### Rate Limiting Errors

| Code                    | HTTP | Description                |
| ----------------------- | ---- | -------------------------- |
| `RATE_LIMIT_EXCEEDED`   | 429  | Too many requests          |
| `USAGE_LIMIT_EXCEEDED`  | 429  | Monthly log quota exceeded |
| `MEMBER_LIMIT_EXCEEDED` | 402  | Team member limit reached  |

### System Errors

| Code                  | HTTP | Description             |
| --------------------- | ---- | ----------------------- |
| `INTERNAL_ERROR`      | 500  | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503  | External service down   |

---

## Rate Limiting

### Limits by Endpoint Type

| Endpoint   | Limit | Window | Scope      |
| ---------- | ----- | ------ | ---------- |
| Global     | 100   | 1 min  | IP address |
| Auth       | 10    | 1 min  | IP address |
| Log Ingest | 1000  | 1 min  | API key    |
| Dashboard  | 100   | 1 min  | User ID    |

### Implementation

**Algorithm:** Sliding window with Redis

**Redis Keys:**

```
ratelimit:{scope}:{identifier}:{window_timestamp}
```

**Response Headers:**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1709568060
Retry-After: 60
```

### Bypassing Rate Limits

Enterprise tier can request higher limits via support.

---

## Deployment

### Prerequisites

- Go 1.21+
- PostgreSQL 14+
- Redis 6+
- Docker (optional)

### Environment Setup

1. **Clone repository**

```bash
git clone <repo>
cd packages/logstack-go
```

2. **Set environment variables**

```bash
cp .env.example .env
# Edit .env with your values
```

3. **Run migrations**

```bash
# Automatic on server start
go run cmd/server/main.go
```

4. **Start server**

```bash
go run cmd/server/main.go
```

Server starts on port 8080 (configurable via `PORT` env var).

---

### Docker Deployment

**Build:**

```bash
docker build -t logstack-backend:latest .
```

**Run:**

```bash
docker run -p 8080:8080 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e JWT_SECRET=your-secret \
  logstack-backend:latest
```

---

### Production Checklist

- [ ] Set strong `JWT_SECRET` (min 32 chars)
- [ ] Use production database (not default)
- [ ] Configure `ALLOWED_ORIGINS`
- [ ] Set up Brevo for emails
- [ ] Configure Paystack for payments
- [ ] Enable HTTPS/TLS
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure log rotation
- [ ] Set up database backups
- [ ] Use connection pooling
- [ ] Enable Redis persistence
- [ ] Set appropriate rate limits
- [ ] Review security headers

---

### Monitoring

**Health Endpoints:**

- `GET /health` - Basic health
- `GET /ready` - Readiness probe

**Metrics (Future):**

- Request latency (p50, p95, p99)
- Error rate
- Log ingestion rate
- Active WebSocket connections
- Database query performance

---

### Database Migrations

**Location:** `packages/logstack-go/migrations/`

**Format:**

- `001_create_users.up.sql` - Apply migration
- `001_create_users.down.sql` - Rollback migration

**Execution:** Automatic via GORM AutoMigrate on server start.

**Current Migrations:**

1. Users table
2. Projects table
3. Logs table
4. Alert rules table
5. Push tokens table
6. Alert history table
7. Subscriptions table
8. Usage logs table
9. Add role to users
10. Add email verification
11. Organizations & members
12. Audit logs

---

## Frontend Integration Guide

### Authentication Flow

1. **Sign Up:**

```typescript
const response = await fetch("http://localhost:8080/v1/auth/signup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    password: "password123",
    name: "John Doe",
  }),
});
const { user, tokens } = await response.json();
localStorage.setItem("accessToken", tokens.accessToken);
```

2. **Authenticated Requests:**

```typescript
const response = await fetch("http://localhost:8080/v1/projects", {
  headers: {
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  },
});
```

3. **Token Refresh:**

```typescript
const response = await fetch("http://localhost:8080/v1/auth/refresh", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    refreshToken: localStorage.getItem("refreshToken"),
  }),
});
const { accessToken } = await response.json();
localStorage.setItem("accessToken", accessToken);
```

---

### Log Ingestion from Client

**Note:** Typically done from backend, but possible from client:

```typescript
const response = await fetch("http://localhost:8080/v1/logs", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    logs: [
      {
        level: "error",
        message: "Something went wrong",
        metadata: { userId: 123, page: "/dashboard" },
        source: "web-app",
      },
    ],
  }),
});
```

---

### Real-Time Log Streaming

```typescript
const ws = new WebSocket(`ws://localhost:8080/ws?projectId=${projectId}`);

ws.onopen = () => console.log("Connected");

ws.onmessage = (event) => {
  const log = JSON.parse(event.data);
  console.log("New log:", log);
  // Update UI with new log
};

ws.onerror = (error) => console.error("WebSocket error:", error);

ws.onclose = () => console.log("Disconnected");
```

---

### Error Handling

```typescript
const response = await fetch("http://localhost:8080/v1/projects", {
  headers: { Authorization: `Bearer ${token}` },
});

if (!response.ok) {
  const error = await response.json();

  switch (error.code) {
    case "INVALID_TOKEN":
      // Redirect to login
      window.location.href = "/login";
      break;

    case "RATE_LIMIT_EXCEEDED":
      // Show rate limit message
      toast.error("Too many requests. Please try again later.");
      break;

    case "USAGE_LIMIT_EXCEEDED":
      // Show upgrade prompt
      showUpgradeModal();
      break;

    default:
      toast.error(error.message);
  }
}
```

---

## Version Control & Updates

### Versioning Strategy

**Format:** `v{major}.{minor}.{patch}`

**Semantic Versioning:**

- **Major:** Breaking API changes
- **Minor:** New features (backward compatible)
- **Patch:** Bug fixes

**Current Version:** v1.0.0

---

### API Versioning

**URL-based:** `/v1/`, `/v2/`

**Strategy:** Maintain v1 for 1 year after v2 release.

---

### Breaking Changes Checklist

1. Document all breaking changes in `CHANGELOG.md`
2. Increment major version
3. Update API documentation
4. Notify clients via email (30-day notice)
5. Deploy new version alongside old version
6. Monitor error rates
7. Deprecate old version after grace period

---

### Database Migration Strategy

**Forward-only:** Never rollback in production.

**Process:**

1. Write migration (up + down)
2. Test locally
3. Test on staging
4. Deploy to production during low-traffic period
5. Verify migration success
6. Monitor for issues

**Backward Compatibility:**

- Add columns as nullable initially
- Use feature flags for schema changes
- Never rename/delete columns without deprecation

---

### Changelog Format

```markdown
## [1.1.0] - 2026-02-10

### Added

- Team member invite via email
- Audit log tracking for all actions

### Changed

- Increased free tier from 1K to 10K logs

### Fixed

- Rate limiting bug causing 429 errors

### Deprecated

- `/v1/old-endpoint` (use `/v1/new-endpoint`)

### Security

- Updated JWT library to v5.0.0
```

---

## Contact & Support

**Documentation:** https://logstack.tech/docs  
**API Status:** https://status.logstack.tech  
**Support Email:** support@logstack.tech  
**GitHub Issues:** https://github.com/logstack/logstack/issues

---

**End of Documentation**
