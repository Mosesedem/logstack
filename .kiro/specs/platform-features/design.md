# Design Document — Logstack Platform Features

## Overview


This document covers the technical design for seven platform features: alert rule refactor, log analytics, QR code login, member management & RBAC, checkout & invoicing, project card controls, and composable middleware. All changes integrate into the existing monorepo without replacing existing functionality.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Next.js 14 (App Router)           Flutter Mobile               │
│  /alerts  /logs  /projects          login_screen                │
│  /billing /checkout /settings/team  qr_scanner_screen           │
│  /invoice/[id]                      auth_provider               │
└────────────────────┬────────────────────────┬───────────────────┘
                     │ HTTPS/WS               │ HTTPS
┌────────────────────▼────────────────────────▼───────────────────┐
│  Gin Router (Go)                                                 │
│  middleware: JWTAuth │ APIKeyAuth │ RBACMiddleware               │
│              PriceGateMiddleware │ UsageLimitMiddleware          │
│  handlers: alerts │ logs │ projects │ auth │ billing │ org       │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┴──────────┐
        ▼                       ▼
   PostgreSQL (GORM)         Redis
   - alert_rules             - QR sessions (TTL 5m)
   - projects (archived_at)  - usage counters
   - invites                 - usage warning flags
   - invoices                - JWT blacklist
```

---

## 1. Alert Rules — Dynamic Options & Schema Refactor

### 1.1 DB Migration

**Migration 015_alter_alert_rules_trigger_patterns.up.sql** (new file — added before invites):

```sql
-- Add trigger_patterns jsonb column, keep trigger_pattern for backwards compat during migration
ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS trigger_patterns jsonb NOT NULL DEFAULT '[]';

-- Migrate existing single pattern to array
UPDATE alert_rules
  SET trigger_patterns = jsonb_build_array(trigger_pattern)
  WHERE trigger_patterns = '[]' AND trigger_pattern IS NOT NULL AND trigger_pattern != '';
```

### 1.2 Go Model Changes

```go
// internal/models/alert.go — updated AlertRule struct
type AlertRule struct {
    ID              uint            `gorm:"primaryKey" json:"id"`
    ProjectID       uuid.UUID       `gorm:"type:uuid;index;not null" json:"projectId"`
    Name            string          `gorm:"size:100;not null" json:"name"`
    TriggerPattern  string          `gorm:"size:500" json:"triggerPattern,omitempty"` // kept for DB compat
    TriggerPatterns pq.StringArray  `gorm:"type:jsonb;default:'[]'" json:"triggerPatterns"`
    TriggerLevel    LogLevel        `gorm:"size:10" json:"triggerLevel,omitempty"`
    Channels        pq.StringArray  `gorm:"type:jsonb;default:'[]'" json:"channels"`
    Channel         AlertChannel    `gorm:"size:20" json:"channel,omitempty"` // kept for compat
    Recipient       string          `gorm:"type:text;not null" json:"recipient"`
    CooldownMinutes int             `gorm:"default:15" json:"cooldownMinutes"`
    Enabled         bool            `gorm:"default:true" json:"enabled"`
    CreatedAt       time.Time       `json:"createdAt"`
    UpdatedAt       time.Time       `json:"updatedAt"`
}

// AlertOptionsResponse returned by GET /v1/alerts/options
type AlertOptionsResponse struct {
    Channels        []string `json:"channels"`
    TriggerPatterns []string `json:"triggerPatterns"`
    TriggerLevels   []string `json:"triggerLevels"`
    CooldownOptions []int    `json:"cooldownOptions"`
}
```

### 1.3 New API Endpoint

`GET /v1/alerts/options` (JWT-protected, no project scope needed):

```go
// Handler method added to AlertsHandler
func (h *AlertsHandler) GetOptions(c *gin.Context) {
    c.JSON(http.StatusOK, models.AlertOptionsResponse{
        Channels:        []string{"email", "push", "webhook"},
        TriggerPatterns: []string{".*error.*", ".*exception.*", ".*fatal.*", ".*critical.*", ".*timeout.*", ".*panic.*"},
        TriggerLevels:   []string{"debug", "info", "warn", "error", "critical", "fatal"},
        CooldownOptions: []int{5, 10, 15, 30, 60},
    })
}
```

Route added: `alerts.GET("/options", alertsHandler.GetOptions)` (before the `/:id` routes to avoid conflict).

### 1.4 Frontend Changes

**`AlertForm` refactor** (`/apps/web/src/components/alerts/alert-form.tsx`):
- On mount: `useQuery` fetches `/v1/alerts/options`
- Channels → rendered as `Checkbox` grid (multi-select), stored as `string[]`
- Trigger patterns → rendered as `Checkbox` list (multi-select), stored as `string[]`
- Cooldown → `Select` dropdown with options from `cooldownOptions` array
- Form state changes: `channels: string[]`, `triggerPatterns: string[]`

**Type additions** (`/apps/web/src/types/index.ts`):
```typescript
export interface AlertOptions {
  channels: string[];
  triggerPatterns: string[];
  triggerLevels: string[];
  cooldownOptions: number[];
}

// AlertRule updated:
export interface AlertRule {
  // ... existing fields
  triggerPatterns: string[];  // replaces triggerPattern
  channels: string[];         // replaces channel
}
```

---

## 2. Log Analytics & Pagination

### 2.1 New API Endpoint

`GET /v1/projects/:id/logs/analytics` — added to the existing `projectRoutes` group (after `RequireProjectOwner` middleware):

```go
// internal/api/handlers/logs.go — new handler and response types
type LogAnalyticsResponse struct {
    TotalCount   int64              `json:"totalCount"`
    CountByLevel map[string]int64   `json:"countByLevel"`
    ErrorRate    float64            `json:"errorRate"`   // percentage 0-100
    TimeSeries   []TimeSeriesBucket `json:"timeSeries"`
}

type TimeSeriesBucket struct {
    Timestamp string `json:"timestamp"` // RFC3339, hourly
    Count     int64  `json:"count"`
}

// Analytics method on ProjectLogsHandler
func (h *ProjectLogsHandler) Analytics(c *gin.Context) {
    projectID := c.MustGet("projectID").(uuid.UUID)
    // Run GROUP BY level COUNT query for last 24h
    // Run GROUP BY hour COUNT query for time series
    // Calculate errorRate = (error+critical+fatal counts) / total * 100
}
```

**QueryBuilder enhancement** — new `Analytics(projectID uuid.UUID, hours int)` method:
```go
func (q *QueryBuilder) Analytics(projectID uuid.UUID, hours int) (*LogAnalyticsResponse, error) {
    since := time.Now().UTC().Add(-time.Duration(hours) * time.Hour)
    // COUNT(*) GROUP BY level WHERE project_id=? AND created_at >= ?
    // COUNT(*) GROUP BY date_trunc('hour', created_at) for time series
}
```

Route: `projectRoutes.GET("/logs/analytics", handlers.NewProjectLogsHandler(cfg.QueryBuilder).Analytics)`

### 2.2 Frontend Changes

**`/apps/web/src/app/(dashboard)/logs/page.tsx`**:
- Add `useQuery` for analytics: `queryKey: ["log-analytics", projectId]`
- Skeleton loaders while loading
- Analytics cards: Total Events, Error Rate %, and a `recharts` `AreaChart` for time series (recharts already installed)

New component: `/apps/web/src/components/logs/log-analytics.tsx`
```typescript
// Props:
interface LogAnalyticsProps {
  projectId: string;
}
// Renders: 3 stat cards + AreaChart for timeSeries
```

**Pagination**: already implemented via `useInfiniteQuery` — ensure `limit` cap is 200 (currently 1000 in handler, reduce to 200 per requirements).

---

## 3. Mobile QR Code Login

### 3.1 Redis QR Session State Machine

```
States: pending → scanned → confirmed | expired
Key pattern: qr:session:<token>
Value: JSON { status, userID (after confirm), createdAt }
TTL: 5 minutes
```

### 3.2 New Go Endpoints

All under `v1/auth` group:

```
POST /v1/auth/qr/generate   (JWT-protected — web user generates QR)
GET  /v1/auth/qr/:token/status  (public — web polls for mobile confirmation)
POST /v1/auth/qr/:token/confirm (public — mobile confirms with credentials)
```

```go
// internal/api/handlers/auth.go — new QR methods on AuthHandler

type QRSession struct {
    Status    string `json:"status"` // "pending" | "confirmed" | "expired"
    UserID    uint   `json:"userId,omitempty"`
    CreatedAt int64  `json:"createdAt"`
}

// GenerateQR: POST /v1/auth/qr/generate (JWT-protected)
// 1. Generate UUID token
// 2. Store QRSession{status:"pending"} in Redis with 5-min TTL: key = "qr:session:" + token
// 3. Generate QR image encoding URL: <FRONTEND_URL>/auth/qr-login?token=<token>
// 4. Return { token, qrImageUrl: "<base64 PNG data URL>" }
// Uses: github.com/skip2/go-qrcode to generate PNG

// GetQRStatus: GET /v1/auth/qr/:token/status (public)
// 1. Read QRSession from Redis
// 2. If not found: 410 QR_EXPIRED
// 3. Return { status }

// ConfirmQR: POST /v1/auth/qr/:token/confirm (public, mobile calls this)
// Body: { email, password } — standard credential auth
// 1. Read QRSession, check status=="pending"
// 2. If confirmed: 409 QR_ALREADY_USED
// 3. Validate credentials (same as Login)
// 4. Update session: status="confirmed", userID=user.ID
// 5. Re-write to Redis with same remaining TTL
// 6. Return JWT token pair to mobile caller
```

**go.mod addition**: `github.com/skip2/go-qrcode v0.0.0-20200617195104-da1b6568686e`

### 3.3 Router Changes

```go
// In router.go auth group (public):
auth.GET("/qr/:token/status", authHandler.GetQRStatus)
auth.POST("/qr/:token/confirm", authHandler.ConfirmQR)

// JWT-protected:
protected.POST("/auth/qr/generate", authHandler.GenerateQR)
```

### 3.4 Flutter Changes

**New screen**: `/apps/mobile/lib/screens/auth/qr_scanner_screen.dart`
- Uses `mobile_scanner` package (add to `pubspec.yaml`)
- On successful scan of URL, extract `token` query param
- Call `POST /v1/auth/qr/:token/confirm` with stored credentials (if already logged in) or prompt
- On success: store tokens via `authProvider`, navigate to `'/'`

**`LoginScreen` changes**:
- Add "Scan QR Code" `OutlinedButton` below the sign-in button
- On tap: `context.push('/qr-scanner')`

**Router addition**: route `/qr-scanner` → `QRScannerScreen`

---

## 4. Member Management & RBAC

### 4.1 DB Migrations

**015_create_invites.up.sql**:
```sql
CREATE TABLE invites (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email       varchar(255) NOT NULL,
    role        varchar(50)  NOT NULL,
    token       varchar(255) UNIQUE NOT NULL,
    status      varchar(20)  NOT NULL DEFAULT 'pending',
    expires_at  timestamptz  NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_invites_token ON invites(token);
CREATE INDEX idx_invites_org_id ON invites(organization_id);
```

### 4.2 Go Model

```go
// internal/models/invite.go
type Invite struct {
    ID             uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
    OrganizationID uuid.UUID  `gorm:"type:uuid;not null" json:"organizationId"`
    Email          string     `gorm:"size:255;not null" json:"email"`
    Role           string     `gorm:"size:50;not null" json:"role"`
    Token          string     `gorm:"size:255;uniqueIndex;not null" json:"-"`
    Status         string     `gorm:"size:20;not null;default:'pending'" json:"status"`
    ExpiresAt      time.Time  `json:"expiresAt"`
    CreatedAt      time.Time  `json:"createdAt"`
    Organization   Organization `gorm:"foreignKey:OrganizationID" json:"organization,omitempty"`
}
```

### 4.3 New API Endpoints

Added to the existing `organizations` group in `router.go`:
```
POST   /v1/organizations/:id/invites           (owner/admin only)
GET    /v1/organizations/:id/invites           (owner/admin only)
DELETE /v1/organizations/:id/invites/:inviteId (owner/admin only)
GET    /v1/auth/accept-invite?token=<token>    (public — redirect to dashboard)
```

### 4.4 RBAC Middleware

**New file**: `/packages/logstack-go/internal/api/middleware/rbac.go`

```go
// RBACMiddleware returns a Gin handler that checks the caller's org role.
// requiredRoles: minimum roles allowed, e.g. "admin" means admin OR owner passes.
// Organization ID is resolved from the ":id" URL param or "organizationId" context key.
func RBACMiddleware(db *gorm.DB, requiredRoles ...string) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.MustGet("userID").(uint)
        orgIDStr := c.Param("id")
        orgID, err := uuid.Parse(orgIDStr)
        if err != nil { c.JSON(403, ErrorResponse{...}); c.Abort(); return }

        var member models.OrganizationMember
        if err := db.Where("organization_id = ? AND user_id = ?", orgID, userID).
            First(&member).Error; err != nil {
            c.JSON(403, ErrorResponse{Code: "NOT_A_MEMBER"}); c.Abort(); return
        }

        if !roleAllowed(member.Role, requiredRoles) {
            c.JSON(403, ErrorResponse{Code: "INSUFFICIENT_ROLE"}); c.Abort(); return
        }
        c.Set("orgRole", member.Role)
        c.Next()
    }
}

func roleAllowed(actual string, required []string) bool {
    hierarchy := map[string]int{"viewer":1,"member":2,"admin":3,"owner":4}
    // owner always passes; check if actual rank >= minimum required rank
}
```

### 4.5 Frontend Changes

**`/apps/web/src/app/(dashboard)/settings/team/page.tsx` additions**:
- Fetch pending invites: `GET /v1/organizations/:id/invites`
- Display pending invites table with email, role, "Revoke" button
- Show/hide Invite button and role dropdowns based on current user's role (owner/admin vs member/viewer)
- "Accept Invite" flow: Next.js route `/auth/accept-invite?token=<t>` calls `GET /v1/auth/accept-invite?token=<t>` then redirects

**RBAC helper hook**: `/apps/web/src/hooks/use-org-role.ts`
```typescript
export function useOrgRole(): "owner"|"admin"|"member"|"viewer"|null
// Reads from the /organizations/me response, memoized via TanStack Query
```

---

## 5. Checkout & Invoicing

### 5.1 DB Migration

**016_create_invoices.up.sql**:
```sql
CREATE TABLE invoices (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      integer NOT NULL REFERENCES users(id),
    reference    varchar(255) UNIQUE NOT NULL,
    amount_cents integer NOT NULL,
    currency     varchar(3) NOT NULL,
    status       varchar(20) NOT NULL DEFAULT 'pending',
    line_items   jsonb NOT NULL DEFAULT '[]',
    paid_at      timestamptz,
    created_at   timestamptz NOT NULL DEFAULT NOW(),
    updated_at   timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_reference ON invoices(reference);
```

### 5.2 Go Model

```go
// internal/models/invoice.go
type InvoiceLineItem struct {
    Description string  `json:"description"`
    Amount      int     `json:"amount"` // cents
    Quantity    int     `json:"quantity"`
}

type Invoice struct {
    ID          uuid.UUID         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
    UserID      uint              `gorm:"not null;index" json:"userId"`
    Reference   string            `gorm:"size:255;uniqueIndex;not null" json:"reference"`
    AmountCents int               `gorm:"not null" json:"amountCents"`
    Currency    string            `gorm:"size:3;not null" json:"currency"`
    Status      string            `gorm:"size:20;not null;default:'pending'" json:"status"` // pending|paid|failed
    LineItems   datatypes.JSON    `gorm:"type:jsonb;not null;default:'[]'" json:"lineItems"`
    PaidAt      *time.Time        `json:"paidAt,omitempty"`
    CreatedAt   time.Time         `json:"createdAt"`
    UpdatedAt   time.Time         `json:"updatedAt"`
    User        User              `gorm:"foreignKey:UserID" json:"user,omitempty"`
}
```

### 5.3 New API Endpoints

```
GET  /v1/billing/invoices        (JWT-protected, paginated)
GET  /v1/billing/invoices/:id    (JWT-protected, ownership check)
```

Added to `billing` group in `router.go`. `HandleWebhook` updated to upsert Invoice on `charge.success`.

```go
func (h *BillingHandler) GetInvoices(c *gin.Context) {
    userID := c.MustGet("userID").(uint)
    page, _ := strconv.Atoi(c.DefaultQuery("page","1"))
    limit := 20
    var invoices []models.Invoice
    var total int64
    h.db.Model(&models.Invoice{}).Where("user_id = ?", userID).
        Count(&total).
        Order("created_at DESC").Offset((page-1)*limit).Limit(limit).Find(&invoices)
    c.JSON(200, gin.H{"invoices": invoices, "total": total, "page": page})
}

func (h *BillingHandler) GetInvoice(c *gin.Context) {
    userID := c.MustGet("userID").(uint)
    id := c.Param("id")
    var invoice models.Invoice
    if err := h.db.Where("id = ? AND user_id = ?", id, userID).First(&invoice).Error; err != nil {
        c.JSON(403, gin.H{"error": "not found"}); return
    }
    c.JSON(200, invoice)
}
```

### 5.4 Frontend Changes

**`/apps/web/src/app/(dashboard)/billing/page.tsx`** — replace `TransactionHistory` with invoice list that navigates to `/invoice/[id]`.

**New page**: `/apps/web/src/app/(dashboard)/invoice/[id]/page.tsx`
- Fetches `GET /v1/billing/invoices/:id`
- Renders: invoice number, date, line items table, totals, status badge
- "Download PDF" button — uses `window.print()` on a print-styled div (no external PDF lib needed)

**Type additions** (`/apps/web/src/types/index.ts`):
```typescript
export interface Invoice {
  id: string;
  userId: number;
  reference: string;
  amountCents: number;
  currency: string;
  status: "pending" | "paid" | "failed";
  lineItems: InvoiceLineItem[];
  paidAt?: string;
  createdAt: string;
}
export interface InvoiceLineItem {
  description: string;
  amount: number;
  quantity: number;
}
```

---

## 6. Project Card Controls

### 6.1 DB Migration

**015_alter_projects_add_archived_at.up.sql** (sequenced before invites):
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX idx_projects_archived_at ON projects(archived_at);
```

### 6.2 Go Changes

**`Project` model** (`internal/models/project.go`) — add field:
```go
ArchivedAt *time.Time `gorm:"index" json:"archivedAt,omitempty"`
```

**`ProjectsHandler`** — updates to `List` and new `Archive` method:
```go
// List: add WHERE archived_at IS NULL unless includeArchived=true
func (h *ProjectsHandler) List(c *gin.Context) {
    includeArchived := c.Query("includeArchived") == "true"
    query := h.db.Where("owner_id = ?", userID)
    if !includeArchived { query = query.Where("archived_at IS NULL") }
    // ... existing logic
}

// Archive: PATCH /v1/projects/:id/archive
func (h *ProjectsHandler) Archive(c *gin.Context) {
    projectID := c.MustGet("projectID").(uuid.UUID)
    now := time.Now()
    h.db.Model(&models.Project{}).Where("id = ?", projectID).
        Update("archived_at", &now)
    c.JSON(200, gin.H{"message": "project archived"})
}
```

Route added: `projectRoutes.PATCH("/archive", projectsHandler.Archive)`

**`GET /v1/billing/usage`** — existing endpoint already returns user-level totals. To support per-project display, `UsageSyncWorker.GetUserUsageSummary` will additionally return a `projectBreakdown` array. Alternatively the frontend fetches usage once and passes the totals down as props (simpler — chosen approach).

### 6.3 Frontend Changes

**`/apps/web/src/app/(dashboard)/projects/page.tsx`**:
- Add `useState<string>` for search query
- Filter `projects` client-side using debounced search (300ms)
- Fetch `GET /v1/billing/usage` once per page load
- Pass `usage` down to each project card

**New component**: `/apps/web/src/components/projects/project-card.tsx`
- Extracts the card JSX from `projects/page.tsx`
- Props: `project`, `usage`, `onRename`, `onArchive`, `onManageMembers`
- Inline rename: `isEditing` local state, `Input` + save/cancel buttons
- Archive: `AlertDialog` confirmation before `PATCH /v1/projects/:id/archive`
- Usage display: mini progress bar (reuse `UsageProgressBar` component)
- "Manage Members" button: `router.push('/settings/team?projectId=' + project.id)`

---

## 7. Price Gate, Tier & RBAC Middleware

### 7.1 FeatureMatrix

**New file**: `/packages/logstack-go/internal/middleware/feature_matrix.go`
```go
var FeatureMatrix = map[models.SubscriptionTier][]string{
    models.TierFree:       {"basic_alerts","email_alerts"},
    models.TierStarter:    {"basic_alerts","email_alerts","webhook_alerts","advanced_filters"},
    models.TierPro:        {"basic_alerts","email_alerts","webhook_alerts","advanced_filters","advanced_alerts","team_management"},
    models.TierEnterprise: {"basic_alerts","email_alerts","webhook_alerts","advanced_filters","advanced_alerts","team_management","sso","audit_logs","custom_retention"},
}

func TierHasFeature(tier models.SubscriptionTier, feature string) bool {
    features, ok := FeatureMatrix[tier]
    if !ok { return false }
    for _, f := range features { if f == feature { return true } }
    return false
}
```

### 7.2 PriceGateMiddleware

**New file**: `/packages/logstack-go/internal/api/middleware/price_gate.go`
```go
func PriceGateMiddleware(db *gorm.DB, feature string) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.MustGet("userID").(uint)
        var sub models.Subscription
        if err := db.Where("user_id = ?", userID).First(&sub).Error; err != nil {
            sub.Tier = models.TierFree
        }
        if !TierHasFeature(sub.Tier, feature) {
            c.JSON(http.StatusPaymentRequired, gin.H{
                "code":       "UPGRADE_REQUIRED",
                "message":    "This feature requires a higher subscription tier.",
                "upgradeUrl": "/checkout",
            })
            c.Abort()
            return
        }
        c.Next()
    }
}
```

### 7.3 Enhanced UsageLimitMiddleware

**Existing file**: `/packages/logstack-go/internal/api/middleware/usage_limit.go`

Enhancement: after counting current usage, check thresholds at **90%** and **100%**:
- At 90%: attempt `SETNX` on Redis key `usage:warned:90:<userID>:<month>` with TTL = seconds remaining in month. If set succeeds, enqueue a goroutine to send warning email.
- At 100%: return HTTP 429 with headers `X-RateLimit-Limit`, `X-RateLimit-Remaining: 0`, `Retry-After: <seconds to month end>`.

### 7.4 Middleware Composability

All new middleware follow the same signature: `func(deps...) gin.HandlerFunc`. Example usage in `router.go`:
```go
// Require org admin role AND pro+ tier to access team management
organizations.PATCH("/:id/members/:memberId",
    middleware.RBACMiddleware(cfg.DB, "admin"),
    middleware.PriceGateMiddleware(cfg.DB, "team_management"),
    orgHandler.UpdateMemberRole,
)
```

---

## 8. Migration Sequence (Final Order)

| # | File | Description |
|---|------|-------------|
| 014 | (existing) | verification_rate_limits |
| 015 | 015_alter_alert_rules.up.sql | Add trigger_patterns jsonb to alert_rules |
| 016 | 016_alter_projects_archived.up.sql | Add archived_at to projects |
| 017 | 017_create_invites.up.sql | invites table |
| 018 | 018_create_invoices.up.sql | invoices table |

The existing requirements doc referenced 015/016 for invites/invoices — migration numbers are shifted by 2 to accommodate the two ALTER TABLE migrations first.

---

## 9. Key Dependencies to Add

| Layer | Package | Purpose |
|-------|---------|---------|
| Go | `github.com/skip2/go-qrcode` | QR code image generation |
| Go | `gorm.io/datatypes` | `datatypes.JSON` type for jsonb fields |
| Flutter | `mobile_scanner: ^5.0.0` | Camera QR scanning |
| Flutter | (no new JS deps needed) | recharts already present |

---

## 10. Correctness Properties (PBT targets)

1. **Alert rule save**: For any valid `AlertRule` created via POST, a subsequent GET must return `triggerPatterns` and `channels` arrays matching the submitted values.
2. **QR session expiry**: Any `ConfirmQR` call after the 5-minute TTL must return 410.
3. **RBAC enforcement**: For any request where the user's org role rank < required rank, the middleware must return 403 before the handler is invoked.
4. **Price gate**: For any request with a `free` tier user to a `pro`-only route, the response must be 402.
5. **Archive exclusion**: `GET /v1/projects` with no params must never include projects where `archived_at IS NOT NULL`.
6. **Usage 90% dedup**: Sending N log batches that cross the 90% threshold must trigger exactly 1 warning email per user per month.

---

## Components and Interfaces

### Go Handler Interfaces

| Handler | New Methods |
|---------|------------|
| `AlertsHandler` | `GetOptions(c)` |
| `ProjectLogsHandler` | `Analytics(c)` |
| `AuthHandler` | `GenerateQR(c)`, `GetQRStatus(c)`, `ConfirmQR(c)`, `AcceptInvite(c)` |
| `OrganizationHandler` | `CreateInvite(c)`, `GetInvites(c)`, `RevokeInvite(c)` |
| `BillingHandler` | `GetInvoices(c)`, `GetInvoice(c)` |
| `ProjectsHandler` | `Archive(c)`, updated `List(c)` |

### Go Middleware Interfaces

```go
// All middleware follow this factory pattern
func RBACMiddleware(db *gorm.DB, requiredRoles ...string) gin.HandlerFunc
func PriceGateMiddleware(db *gorm.DB, feature string) gin.HandlerFunc
// Enhanced existing:
func (u *UsageLimitMiddleware) Enforce() gin.HandlerFunc  // unchanged signature
```

### Go Service Interfaces

```go
// QueryBuilder additions
func (q *QueryBuilder) Analytics(projectID uuid.UUID, hours int) (*models.LogAnalyticsResponse, error)

// notification.EmailNotifier additions
func (e *EmailNotifier) SendInviteEmail(ctx context.Context, email, orgName, role, inviteURL string) error
func (e *EmailNotifier) SendUsageWarningEmail(ctx context.Context, email, name string, pct float64) error
```

### Next.js Component Interfaces

```typescript
// New components and their props
interface LogAnalyticsProps { projectId: string }
interface ProjectCardProps {
  project: Project
  usageSummary: UsageSummary | null
  onArchive: (id: string) => void
  onRename: (id: string, newName: string) => void
  onRefresh: () => void
}

// New hooks
function useOrgRole(): "owner" | "admin" | "member" | "viewer" | null
```

### Flutter Interfaces

```dart
// AuthService additions
Future<TokenPair> confirmQR(String token, String email, String password);

// AuthProvider additions
void setTokensFromPair(TokenPair pair);

// New screen
class QRScannerScreen extends ConsumerStatefulWidget
```

---

## Data Models

### New Go Models

```go
// models/invite.go
type Invite struct {
    ID             uuid.UUID    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
    OrganizationID uuid.UUID    `gorm:"type:uuid;not null"`
    Email          string       `gorm:"size:255;not null"`
    Role           string       `gorm:"size:50;not null"`
    Token          string       `gorm:"size:255;uniqueIndex;not null"`
    Status         string       `gorm:"size:20;not null;default:'pending'"`
    ExpiresAt      time.Time
    CreatedAt      time.Time
}

// models/invoice.go
type Invoice struct {
    ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
    UserID      uint           `gorm:"not null;index"`
    Reference   string         `gorm:"size:255;uniqueIndex;not null"`
    AmountCents int            `gorm:"not null"`
    Currency    string         `gorm:"size:3;not null"`
    Status      string         `gorm:"size:20;not null;default:'pending'"`
    LineItems   datatypes.JSON `gorm:"type:jsonb;not null;default:'[]'"`
    PaidAt      *time.Time
    CreatedAt   time.Time
    UpdatedAt   time.Time
}

// models/analytics.go
type LogAnalyticsResponse struct {
    TotalCount   int64              `json:"totalCount"`
    CountByLevel map[string]int64   `json:"countByLevel"`
    ErrorRate    float64            `json:"errorRate"`
    TimeSeries   []TimeSeriesBucket `json:"timeSeries"`
}
type TimeSeriesBucket struct {
    Timestamp string `json:"timestamp"`
    Count     int64  `json:"count"`
}
```

### Modified Go Models

```go
// models/alert.go — additions
TriggerPatterns pq.StringArray `gorm:"type:jsonb;default:'[]'" json:"triggerPatterns"`
Channels        pq.StringArray `gorm:"type:jsonb;default:'[]'" json:"channels"`

// models/project.go — addition
ArchivedAt *time.Time `gorm:"index" json:"archivedAt,omitempty"`
```

### New TypeScript Types

```typescript
interface AlertOptions { channels: string[]; triggerPatterns: string[]; triggerLevels: string[]; cooldownOptions: number[] }
interface Invoice { id: string; userId: number; reference: string; amountCents: number; currency: string; status: "pending"|"paid"|"failed"; lineItems: InvoiceLineItem[]; paidAt?: string; createdAt: string }
interface InvoiceLineItem { description: string; amount: number; quantity: number }
// AlertRule updated: triggerPatterns: string[]; channels: string[]
// Project updated: archivedAt?: string
```

### Redis Key Schema

| Key Pattern | TTL | Value | Purpose |
|-------------|-----|-------|---------|
| `qr:session:<token>` | 5 min | `{"status":"pending\|confirmed","userId":N}` | QR login session |
| `usage:warned:90:<userID>:<month>` | seconds to month end | `"1"` | 90% usage warning dedup |
| `usage:<month>:<projectID>` | (existing) | int64 | Log count counter |

---

## Correctness Properties

### Property 1: Alert rule array roundtrip
POST an `AlertRule` with arbitrary `triggerPatterns` and `channels` arrays → GET by ID → the returned arrays must equal the submitted values (order-insensitive).

**Validates: Requirements 1.1, 1.2, 1.3, 1.6, 1.9**

### Property 2: QR session expiry
`ConfirmQR` called after the Redis TTL has elapsed → must return HTTP 410 with `Code: "QR_EXPIRED"`. No JWT tokens are returned.

**Validates: Requirements 3.7**

### Property 3: QR reuse prevention
`ConfirmQR` called on a token already in `status="confirmed"` → must return HTTP 409 with `Code: "QR_ALREADY_USED"`.

**Validates: Requirements 3.8**

### Property 4: RBAC role hierarchy enforcement
For roles ranked `viewer < member < admin < owner`, any request by a role with rank strictly below the required rank must receive HTTP 403 before the handler executes.

**Validates: Requirements 4.6, 4.7, 7.4**

### Property 5: Price gate tier blocking
A `free`-tier user calling any route protected by `PriceGateMiddleware("team_management")` must receive HTTP 402. No business logic runs.

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 6: Archive exclusion from default list
After `PATCH /v1/projects/:id/archive`, every subsequent `GET /v1/projects` (without `includeArchived=true`) must not contain the archived project's ID.

**Validates: Requirements 6.7, 6.8, 6.10**

### Property 7: Invite expiry enforcement
`AcceptInvite` called with a token whose `expires_at < NOW()` must return HTTP 410 with `Code: "INVITE_EXPIRED"`.

**Validates: Requirements 4.3**

### Property 8: Usage 90% warning dedup
For any user, exactly 1 warning email is sent per calendar month when usage crosses 90%, regardless of how many log ingestion requests cross the threshold.

**Validates: Requirements 7.6, 7.8**

---

## Error Handling

### Go API Layer

All errors follow the existing `ErrorResponse{Code, Message}` pattern. New error codes:

| Code | HTTP | Trigger |
|------|------|---------|
| `QR_EXPIRED` | 410 | QR token TTL elapsed |
| `QR_ALREADY_USED` | 409 | QR token already confirmed |
| `INVITE_EXPIRED` | 410 | Invite `expires_at` in past |
| `INVITE_INVALID` | 404 | Invite token not found |
| `UPGRADE_REQUIRED` | 402 | Tier does not include feature |
| `INSUFFICIENT_ROLE` | 403 | Org role too low |
| `NOT_A_MEMBER` | 403 | User has no org membership |
| `CANNOT_MODIFY_OWNER` | 403 | Admin tried to change owner role |

### Frontend Error Handling

- All new `useQuery` hooks display skeleton loaders on loading and inline error messages on failure (no full-page error boundaries).
- All mutations show toast notifications on success and error using the existing `useToast` hook.
- The QR panel handles 410 with a "QR expired — refresh" button and stops polling.
- The invoice detail page handles 403/404 with a friendly "Invoice not found" card.

### Mobile Error Handling

- `QRScannerScreen` catches all `DioException` errors and shows an inline banner with the error message and a "Try Again" button without navigating away.
- Auth state errors (expired tokens) are handled by the existing `authProvider` interceptor.

---

## Testing Strategy

### Unit Tests (Go)

- `QueryBuilder.Analytics`: mock DB, assert correct `CountByLevel` computation and zero-filling of missing time buckets.
- `TierHasFeature`: table-driven tests for all tier/feature combinations.
- `RBACMiddleware`: mock gin context with different roles, assert 200/403 outcomes.
- `PriceGateMiddleware`: mock DB subscription, assert 200/402 outcomes.
- `UsageLimitMiddleware` threshold logic: mock Redis + usage values, assert 90% email trigger and 100% HTTP 429.

### Integration Tests (Go)

- `POST /v1/auth/qr/generate` → `GET /v1/auth/qr/:token/status` → `POST /v1/auth/qr/:token/confirm` full flow.
- `POST /v1/organizations/:id/invites` → `GET /v1/auth/accept-invite?token=<t>` full invite acceptance flow.

### Frontend Tests (Next.js)

- `LogAnalytics` component: mock TanStack Query, assert chart renders with time series data.
- `AlertForm`: mock options query, assert checkboxes render for each channel and pattern.
- `ProjectCard`: assert archive dialog appears and calls `PATCH` endpoint.

### Mobile Tests (Flutter)

- `QRScannerScreen`: unit test `confirmQR` method with mock `AuthService`.
- `LoginScreen`: widget test asserts "Scan QR Code" button is present.
