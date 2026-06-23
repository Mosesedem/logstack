# Implementation Plan: Logstack Platform Features

## Overview

This plan covers 7 features: alert rules refactor, log analytics, QR code login, member management & RBAC, checkout & invoicing, project card controls, and composable backend middleware. Tasks are ordered so DB migrations run before Go model changes, Go handlers before frontend, and backend endpoints before mobile integration.

## Tasks

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": [1, 2, 3, 4, 5, 6, 7, 8, 9]
    },
    {
      "wave": 2,
      "tasks": [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    },
    {
      "wave": 3,
      "tasks": [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37]
    },
    {
      "wave": 4,
      "tasks": [38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60]
    },
    {
      "wave": 5,
      "tasks": [61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73]
    }
  ]
}
```

- [x] 1. Create `packages/logstack-go/migrations/015_alter_alert_rules_trigger_patterns.up.sql` — add `trigger_patterns jsonb NOT NULL DEFAULT '[]'` column to `alert_rules`; migrate existing data: `UPDATE alert_rules SET trigger_patterns = jsonb_build_array(trigger_pattern) WHERE trigger_patterns = '[]' AND trigger_pattern IS NOT NULL AND trigger_pattern != ''`
- [x] 2. Create `packages/logstack-go/migrations/015_alter_alert_rules_trigger_patterns.down.sql` — `ALTER TABLE alert_rules DROP COLUMN IF EXISTS trigger_patterns`
- [x] 3. Create `packages/logstack-go/migrations/016_alter_projects_add_archived_at.up.sql` — `ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at timestamptz; CREATE INDEX idx_projects_archived_at ON projects(archived_at)`
- [x] 4. Create `packages/logstack-go/migrations/016_alter_projects_add_archived_at.down.sql` — `DROP INDEX IF EXISTS idx_projects_archived_at; ALTER TABLE projects DROP COLUMN IF EXISTS archived_at`
- [x] 5. Create `packages/logstack-go/migrations/017_create_invites.up.sql` — create `invites` table: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`, `email varchar(255) NOT NULL`, `role varchar(50) NOT NULL`, `token varchar(255) UNIQUE NOT NULL`, `status varchar(20) NOT NULL DEFAULT 'pending'`, `expires_at timestamptz NOT NULL`, `created_at timestamptz NOT NULL DEFAULT NOW()`; add indexes on `token` and `organization_id`
- [x] 6. Create `packages/logstack-go/migrations/017_create_invites.down.sql` — `DROP TABLE IF EXISTS invites`
- [x] 7. Create `packages/logstack-go/migrations/018_create_invoices.up.sql` — create `invoices` table: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id integer NOT NULL REFERENCES users(id)`, `reference varchar(255) UNIQUE NOT NULL`, `amount_cents integer NOT NULL`, `currency varchar(3) NOT NULL`, `status varchar(20) NOT NULL DEFAULT 'pending'`, `line_items jsonb NOT NULL DEFAULT '[]'`, `paid_at timestamptz`, `created_at timestamptz NOT NULL DEFAULT NOW()`, `updated_at timestamptz NOT NULL DEFAULT NOW()`; add indexes on `user_id` and `reference`
- [x] 8. Create `packages/logstack-go/migrations/018_create_invoices.down.sql` — `DROP TABLE IF EXISTS invoices`
- [x] 9. Register all four new migrations (015–018) in `packages/logstack-go/internal/db/migrations.go` so they execute on server startup in order

- [x] 10. Update `packages/logstack-go/internal/models/alert.go` — add `TriggerPatterns pq.StringArray` with `gorm:"type:jsonb;default:'[]'" json:"triggerPatterns"` and `Channels pq.StringArray` with `gorm:"type:jsonb;default:'[]'" json:"channels"`; keep existing `TriggerPattern` and `Channel` fields for DB compatibility; add `AlertOptionsResponse` struct with `Channels []string`, `TriggerPatterns []string`, `TriggerLevels []string`, `CooldownOptions []int`; update `AlertRuleCreateRequest` and `AlertRuleUpdateRequest` to include the new array fields
- [x] 11. Update `packages/logstack-go/internal/models/project.go` — add `ArchivedAt *time.Time` with `gorm:"index" json:"archivedAt,omitempty"`; update `ProjectResponse` struct and `ToResponse()` to include `ArchivedAt`
- [x] 12. Create `packages/logstack-go/internal/models/invite.go` — define `Invite` struct with all fields from migration 017 plus `Organization Organization` relation; add `IsExpired() bool` helper
- [x] 13. Create `packages/logstack-go/internal/models/invoice.go` — define `InvoiceLineItem` struct (`Description string`, `Amount int`, `Quantity int`); define `Invoice` struct with all fields from migration 018 using `datatypes.JSON` for `LineItems`; add `User User` relation
- [x] 14. Add `gorm.io/datatypes` to `packages/logstack-go/go.mod` and run `go mod tidy` if not already present
- [x] 15. Create `packages/logstack-go/internal/models/analytics.go` — define `LogAnalyticsResponse` struct (`TotalCount int64`, `CountByLevel map[string]int64`, `ErrorRate float64`, `TimeSeries []TimeSeriesBucket`) and `TimeSeriesBucket` struct (`Timestamp string`, `Count int64`)

- [x] 16. Add `GetOptions` method to `AlertsHandler` in `packages/logstack-go/internal/api/handlers/alerts.go` — returns hardcoded `AlertOptionsResponse{Channels: ["email","push","webhook"], TriggerPatterns: [".*error.*",".*exception.*",".*fatal.*",".*critical.*",".*timeout.*",".*panic.*"], TriggerLevels: ["debug","info","warn","error","critical","fatal"], CooldownOptions: [5,10,15,30,60]}`
- [x] 17. Update `AlertsHandler.Create` and `AlertsHandler.Update` in `internal/api/handlers/alerts.go` to read `TriggerPatterns []string` and `Channels []string` from the request body and persist them to the `AlertRule` record
- [x] 18. Add `Analytics(projectID uuid.UUID, hours int) (*models.LogAnalyticsResponse, error)` method to `QueryBuilder` in `packages/logstack-go/internal/services/query_builder.go` — run `COUNT(*) GROUP BY level` and `COUNT(*) GROUP BY date_trunc('hour', created_at)` for the last N hours; compute `ErrorRate = (error+critical+fatal counts) / total * 100`; fill all 24 hourly buckets (zero-fill missing hours)
- [x] 19. Add `Analytics` method to `ProjectLogsHandler` in `packages/logstack-go/internal/api/handlers/logs.go` — calls `queryBuilder.Analytics(projectID, 24)` and returns the response; reduce `limit` cap in `ProjectLogsHandler.Query` from 1000 to 200
- [x] 20. Add `github.com/skip2/go-qrcode v0.0.0-20200617195104-da1b6568686e` to `packages/logstack-go/go.mod` and run `go mod tidy`

- [x] 21. Add `GenerateQR` method to `AuthHandler` in `packages/logstack-go/internal/api/handlers/auth.go` — generate UUID token; store `{"status":"pending","createdAt":<unix>}` JSON in Redis key `qr:session:<token>` with 5-minute TTL; generate QR PNG image encoding `<FRONTEND_URL>/auth/qr-login?token=<token>` using `go-qrcode`; base64-encode PNG; return `{ "token": "<uuid>", "qrImageUrl": "data:image/png;base64,..." }`
- [x] 22. Add `GetQRStatus` method to `AuthHandler` — read Redis key `qr:session:<token>`; if missing return HTTP 410 `ErrorResponse{Code:"QR_EXPIRED"}`; otherwise return `{"status": <value>}`
- [x] 23. Add `ConfirmQR` method to `AuthHandler` — read session; if missing → 410; if `status=="confirmed"` → 409 `ErrorResponse{Code:"QR_ALREADY_USED"}`; validate `email`+`password` credentials using same logic as `Login`; update session to `{"status":"confirmed","userId":<id>}` in Redis with 1-minute TTL; return JWT token pair to caller
- [x] 24. Add `CreateInvite` method to `OrganizationHandler` in `packages/logstack-go/internal/api/handlers/organization.go` — verify caller is owner or admin; generate secure token (32-byte hex); create `Invite` record with 48h `ExpiresAt`; send invite email via `emailNotifier.SendInviteEmail(ctx, email, orgName, role, inviteURL)`
- [x] 25. Add `GetInvites` method to `OrganizationHandler` — verify caller is owner or admin; return all invites for the org
- [x] 26. Add `RevokeInvite` method to `OrganizationHandler` — verify caller is owner or admin; delete pending invite by ID; return 404 if not found
- [x] 27. Add `AcceptInvite` handler to `AuthHandler` — `GET /v1/auth/accept-invite?token=<t>`; look up invite by token; check `expires_at > NOW()` else return 410 `ErrorResponse{Code:"INVITE_EXPIRED"}`; create `OrganizationMember` record; set invite `status="accepted"`; return 200 with JWT tokens (create/login user if not exists)
- [x] 28. Add `SendInviteEmail` method to `packages/logstack-go/internal/services/notification/email.go` — sends invite email with `inviteURL`, `orgName`, `role`
- [x] 29. Add `GetInvoices` method to `BillingHandler` in `packages/logstack-go/internal/api/handlers/billing.go` — paginated list (`page`, `limit=20`) of invoices for authenticated user ordered by `created_at DESC`; return `{"invoices": [...], "total": N, "page": P}`
- [x] 30. Add `GetInvoice` method to `BillingHandler` — single invoice by ID with ownership check; return HTTP 403 if `user_id` does not match authenticated user
- [x] 31. Update `BillingHandler.HandleWebhook` — on `charge.success` Paystack event, upsert an `Invoice` record: find by `reference`; if not found create with `status="pending"`; set `status="paid"`, `PaidAt=now`; populate `LineItems` from Paystack payload description fields
- [x] 32. Add `Archive` method to `ProjectsHandler` in `packages/logstack-go/internal/api/handlers/projects.go` — set `archived_at = NOW()` on the project; return HTTP 200 with updated project JSON
- [x] 33. Update `ProjectsHandler.List` — add `WHERE archived_at IS NULL` to the default query; skip this filter when `includeArchived=true` query param is present
- [x] 34. Create `packages/logstack-go/internal/api/middleware/feature_matrix.go` — define `FeatureMatrix map[models.SubscriptionTier][]string` with entries for free/starter/pro/enterprise tiers; implement `TierHasFeature(tier models.SubscriptionTier, feature string) bool`
- [x] 35. Create `packages/logstack-go/internal/api/middleware/price_gate.go` — implement `PriceGateMiddleware(db *gorm.DB, feature string) gin.HandlerFunc`; look up user subscription from DB; call `TierHasFeature`; if blocked return HTTP 402 `ErrorResponse{Code:"UPGRADE_REQUIRED", Message:"This feature requires a higher subscription tier.", upgradeUrl:"/checkout"}`
- [x] 36. Create `packages/logstack-go/internal/api/middleware/rbac.go` — implement `RBACMiddleware(db *gorm.DB, requiredRoles ...string) gin.HandlerFunc`; resolve org ID from `:id` URL param; query `OrganizationMember` by `organization_id + user_id`; define role hierarchy `viewer=1, member=2, admin=3, owner=4`; if actual rank < minimum required rank return HTTP 403 `ErrorResponse{Code:"INSUFFICIENT_ROLE"}`; set `orgRole` on gin context
- [x] 37. Update `packages/logstack-go/internal/api/middleware/usage_limit.go` — after computing usage percentage: check 90% threshold with `SETNX usage:warned:90:<userID>:<month>` (TTL = seconds to month end); if key was set (first time), asynchronously call `emailNotifier.SendUsageAlert` with 90% message; at 100% abort with HTTP 429 and set `X-RateLimit-Limit`, `X-RateLimit-Remaining: 0`, `Retry-After` response headers

- [x] 38. Register all new routes in `packages/logstack-go/internal/api/router.go`:
  - `alerts.GET("/options", alertsHandler.GetOptions)` (before `/:id` routes)
  - `projectRoutes.GET("/logs/analytics", projectLogsHandler.Analytics)`
  - `projectRoutes.PATCH("/archive", projectsHandler.Archive)`
  - `auth.GET("/qr/:token/status", authHandler.GetQRStatus)` (public)
  - `auth.POST("/qr/:token/confirm", authHandler.ConfirmQR)` (public)
  - `auth.GET("/accept-invite", authHandler.AcceptInvite)` (public)
  - `protected.POST("/auth/qr/generate", authHandler.GenerateQR)` (JWT-protected)
  - `organizations.POST("/:id/invites", orgHandler.CreateInvite)`
  - `organizations.GET("/:id/invites", orgHandler.GetInvites)`
  - `organizations.DELETE("/:id/invites/:inviteId", orgHandler.RevokeInvite)`
  - `billing.GET("/invoices", billingHandler.GetInvoices)`
  - `billing.GET("/invoices/:id", billingHandler.GetInvoice)`
- [x] 39. Apply `RBACMiddleware(cfg.DB, "admin")` to `CreateInvite`, `GetInvites`, `RevokeInvite`, and `UpdateMemberRole` routes in `router.go`
- [x] 40. Apply `PriceGateMiddleware(cfg.DB, "team_management")` to `UpdateMemberRole`, `CreateInvite`, `GetInvites`, and `RevokeInvite` routes in `router.go`

- [x] 41. Update `apps/web/src/types/index.ts` — add `AlertOptions` interface; update `AlertRule` to replace `triggerPattern: string` with `triggerPatterns: string[]` and `channel: AlertChannel` with `channels: string[]`; add `Invoice` interface (`id`, `userId`, `reference`, `amountCents`, `currency`, `status`, `lineItems`, `paidAt`, `createdAt`); add `InvoiceLineItem` interface (`description`, `amount`, `quantity`)
- [x] 42. Refactor `apps/web/src/components/alerts/alert-form.tsx` — add `useQuery` on mount to fetch `GET /v1/alerts/options`; replace channel `Select` with checkbox group rendered from `options.channels` (state: `channels: string[]`); replace trigger pattern `Input` with checkbox list rendered from `options.triggerPatterns` (state: `triggerPatterns: string[]`); replace cooldown number input with `Select` dropdown from `options.cooldownOptions`; show skeleton loaders while options are loading; submit `channels` and `triggerPatterns` arrays
- [x] 43. Update `apps/web/src/components/alerts/alert-list.tsx` — display `channels` as badge array and `triggerPatterns` as comma-separated tags instead of single values
- [x] 44. Create `apps/web/src/components/logs/log-analytics.tsx` — props: `projectId: string`; fetch `GET /v1/projects/:id/logs/analytics` via `useQuery`; render 3 stat cards (Total Events, Error Rate %, Warn Count); render `recharts` `AreaChart` for `timeSeries` (24h activity); show skeleton `Card` placeholders while loading
- [x] 45. Update `apps/web/src/app/(dashboard)/logs/page.tsx` — import and render `<LogAnalytics projectId={projectId} />` above `<LogFilters />`; invalidate `["log-analytics", projectId]` when filters change
- [x] 46. Create `apps/web/src/hooks/use-org-role.ts` — calls `GET /v1/organizations/me` via TanStack Query; returns the current user's `role` field from org membership
- [x] 47. Update `apps/web/src/app/(dashboard)/settings/team/page.tsx` — add fetch for `GET /v1/organizations/:id/invites`; add "Pending Invites" section with email, role, "Revoke" button (owner/admin only); gate "Invite Member" button with `useOrgRole()` check; show read-only role badges for member/viewer users; "Revoke" calls `DELETE /v1/organizations/:id/invites/:inviteId`
- [x] 48. Create `apps/web/src/app/(auth)/accept-invite/page.tsx` — reads `?token=` from URL; calls `GET /v1/auth/accept-invite?token=<t>`; on success redirects to `/overview` with success toast; on error shows friendly message with link to contact admin
- [x] 49. Create `apps/web/src/app/(auth)/login/qr-panel.tsx` (or add QR tab to existing login page) — on mount call `POST /v1/auth/qr/generate`; render QR image; poll `GET /v1/auth/qr/:token/status` every 3 seconds; on `status==="confirmed"` redirect to dashboard; on 410 show "QR expired" + regenerate button
- [x] 50. Update `apps/web/src/app/(dashboard)/billing/page.tsx` — replace `TransactionHistory` with invoice list fetching `GET /v1/billing/invoices`; each row is clickable and navigates to `/invoice/[id]`; show reference, date, amount (formatted), status badge
- [x] 51. Create `apps/web/src/app/(dashboard)/invoice/[id]/page.tsx` — fetch `GET /v1/billing/invoices/:id`; render invoice header (number, date, status), line items table (description, qty, unit amount, total), subtotal/total rows; "Download PDF" button calls `window.print()` on a `@media print`-styled container; show 403/404 error states
- [x] 52. Create `apps/web/src/components/projects/project-card.tsx` — extract card JSX from `projects/page.tsx`; props: `project: Project`, `usageSummary: UsageSummary | null`, `onArchive`, `onRename`, `onRefresh`; add inline rename (local `isEditing` state with `Input` + save/cancel, calls `PUT /v1/projects/:id`, optimistic update with revert on error); archive confirmation `AlertDialog` calling `PATCH /v1/projects/:id/archive`; mini `UsageProgressBar` showing log count vs limit; "Manage Members" button navigating to `/settings/team?projectId=<id>`
- [x] 53. Update `apps/web/src/app/(dashboard)/projects/page.tsx` — add debounced `searchQuery` state (300ms); render search `Input` above project grid; filter projects client-side; fetch `GET /v1/billing/usage` once and pass `usageSummary` to each `<ProjectCard>`; render `<ProjectCard>` instead of inline card JSX; remove archived projects from grid on archive success with toast

- [x] 54. Add `mobile_scanner: ^5.0.0` to `apps/mobile/pubspec.yaml` and run `flutter pub get`
- [x] 55. Add camera permissions to `apps/mobile/android/app/src/main/AndroidManifest.xml` (`CAMERA` permission) and `apps/mobile/ios/Runner/Info.plist` (`NSCameraUsageDescription`)
- [x] 56. Add `confirmQR(String token, String email, String password) Future<TokenPair>` method to `apps/mobile/lib/services/auth_service.dart` — calls `POST /v1/auth/qr/:token/confirm` with credentials; parses and returns `TokenPair`
- [x] 57. Create `apps/mobile/lib/screens/auth/qr_scanner_screen.dart` — `MobileScanner` widget; `onDetect` callback parses scanned URL and extracts `token` query param; calls `authService.confirmQR(token, email, password)`; on success calls `ref.read(authProvider.notifier).setTokensFromPair(tokenPair)` and `context.go('/')`; on error shows inline error banner and "Try Again" button; shows `CircularProgressIndicator` while confirming
- [x] 58. Add route `/qr-scanner` → `QRScannerScreen` in `apps/mobile/lib/router.dart`
- [x] 59. Update `apps/mobile/lib/screens/auth/login_screen.dart` — add `OutlinedButton` "Scan QR Code" below the `FilledButton`; `onPressed: () => context.push('/qr-scanner')`
- [x] 60. Add `setTokensFromPair(TokenPair pair)` method to `apps/mobile/lib/providers/auth_provider.dart` if not present — stores tokens securely via `StorageService` and updates auth state

- [x] 61. Write property-based test for alert rule save/read roundtrip — generate random `triggerPatterns` and `channels` arrays, POST to create rule, GET by ID, verify arrays match exactly
- [x] 62. Write property-based test for QR session expiry — mock Redis TTL; call `ConfirmQR` after 5 minutes; assert HTTP 410 response
- [x] 63. Write property-based test for RBAC enforcement — for each role with rank < required rank, assert middleware returns HTTP 403 before handler is invoked
- [x] 64. Write property-based test for price gate — for free-tier user requesting a pro-only feature, assert HTTP 402 response
- [x] 65. Write property-based test for archive exclusion — after archiving a project, assert `GET /v1/projects` response never includes the archived project ID
- [x] 66. Write property-based test for usage 90% dedup — simulate N log ingestion calls crossing 90% threshold; assert exactly 1 warning email sent per user per month

- [x] 67. Run `go build ./...` from `packages/logstack-go` and fix any compile errors introduced by model/handler changes
- [x] 68. Run `pnpm build` from `apps/web` and fix any TypeScript errors from type changes
- [x] 69. Run `flutter analyze` from `apps/mobile` and resolve any Dart analysis warnings or errors
- [x] 70. Verify all migrations run cleanly against a local PostgreSQL instance in sequence (015→016→017→018)
- [x] 71. Update `packages/logstack-go/openapi.yaml` — add spec entries for all new endpoints: `GET /alerts/options`, `GET /projects/{id}/logs/analytics`, `PATCH /projects/{id}/archive`, `POST /auth/qr/generate`, `GET /auth/qr/{token}/status`, `POST /auth/qr/{token}/confirm`, `GET /auth/accept-invite`, `POST /organizations/{id}/invites`, `GET /organizations/{id}/invites`, `DELETE /organizations/{id}/invites/{inviteId}`, `GET /billing/invoices`, `GET /billing/invoices/{id}`
- [x] 72. Export `LogAnalytics` component from `apps/web/src/components/logs/index.ts` and `ProjectCard` from `apps/web/src/components/projects/index.ts` (create index files if they don't exist)
- [x] 73. Verify end-to-end: create alert rule with multi-select channels/patterns, view log analytics chart, generate QR on web and confirm on mobile, invite team member by email, view invoice detail page, archive a project, confirm archived project excluded from list

## Notes

- Migrations 015–018 shift the numbering from the requirements doc (which listed 015/016 for invites/invoices) to accommodate the two ALTER TABLE migrations first. Update any references accordingly.
- `pq.StringArray` requires `github.com/lib/pq` which is already a transitive GORM dependency for PostgreSQL.
- The QR flow assumes the mobile user is not pre-authenticated; `ConfirmQR` accepts email+password directly. If the mobile user is already logged in, their existing credentials can be pre-filled.
- `window.print()` PDF approach for invoices is a zero-dependency solution. A dedicated PDF library can replace it later without changing the route structure.
- The `UsageLimitMiddleware` 90% email uses `SETNX` (set-if-not-exists) for dedup. The TTL is set to `time.Until(endOfMonth())` so the key auto-expires and allows a new warning next month.
