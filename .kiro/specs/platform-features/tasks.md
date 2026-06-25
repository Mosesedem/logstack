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
      "tasks": [1, 2, 3, 4, 5, 6, 7, 8, 9, 21, 22]
    },
    {
      "wave": 2,
      "tasks": [10, 11, 12, 13, 14, 15, 23]
    },
    {
      "wave": 3,
      "tasks": [16, 17, 18, 19, 20, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43]
    },
    {
      "wave": 4,
      "tasks": [44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70]
    },
    {
      "wave": 5,
      "tasks": [71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84]
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

- [x] 21. Create `packages/logstack-go/migrations/019_create_mobile_refresh_tokens.up.sql` — `CREATE TABLE mobile_refresh_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, token varchar(512) UNIQUE NOT NULL, device_info text, revoked boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT NOW()); CREATE INDEX idx_mrt_user_id ON mobile_refresh_tokens(user_id); CREATE INDEX idx_mrt_token ON mobile_refresh_tokens(token)`
- [x] 22. Create `packages/logstack-go/migrations/019_create_mobile_refresh_tokens.down.sql` — `DROP TABLE IF EXISTS mobile_refresh_tokens`
- [x] 23. Create `packages/logstack-go/internal/models/mobile_refresh_token.go` — define `MobileRefreshToken` struct: `ID uuid`, `UserID uint`, `Token string` (size:512, uniqueIndex), `DeviceInfo string`, `Revoked bool` (default:false), `CreatedAt time.Time`; register model in `db/migrations.go`

- [x] 24. Add `GenerateQR` method to `AuthHandler` in `packages/logstack-go/internal/api/handlers/auth.go` — requires JWT auth (web user); generate UUID token; generate cryptographically random 6-digit PIN using `crypto/rand` (zero-padded); store `{"status":"pending","pin":"<pin>","createdAt":<unix>}` JSON in Redis key `qr:session:<token>` with **10-minute** TTL; also store `qr:pin:<pin>` = `<token>` with same 10-minute TTL; encode URL `<FRONTEND_URL>/link-mobile?token=<token>`; generate QR PNG using `go-qrcode`; base64-encode PNG; return `{ "token": "<uuid>", "pin": "<6-digit>", "qrImageUrl": "data:image/png;base64,..." }`
- [x] 25. Add `GetQRStatus` method to `AuthHandler` — requires JWT auth (same web user); read Redis key `qr:session:<token>`; if missing return HTTP 410 `ErrorResponse{Code:"QR_EXPIRED"}`; return `{"status": <value>}` only (never expose pin or userId in this response)
- [x] 26. Add `ConfirmQR` method to `AuthHandler` — public endpoint; body: `{ email, password }`; read `qr:session:<token>`; if missing → 410; if `status=="confirmed"` → 409 `ErrorResponse{Code:"QR_ALREADY_USED"}`; validate credentials using same logic as `Login`; update session to `{"status":"confirmed","userId":<id>}` in Redis with remaining TTL; delete `qr:pin:<pin>` key; create `MobileRefreshToken` record in DB (no expiry); return `{ "accessToken": "<jwt>", "refreshToken": "<mrt-token>" }`
- [x] 27. Add `ConfirmQRByPIN` method to `AuthHandler` — public endpoint; body: `{ pin, email, password }`; look up token from Redis key `qr:pin:<pin>`; if missing → 410 `ErrorResponse{Code:"QR_EXPIRED"}`; delegate to same confirm logic as `ConfirmQR` using the resolved token
- [x] 28. Add `RefreshMobileToken` method to `AuthHandler` — public endpoint; body: `{ refreshToken }`; look up `MobileRefreshToken` by token value; if not found or `revoked=true` → 401 `ErrorResponse{Code:"TOKEN_REVOKED"}`; load user; if account is blocked → 401 `ErrorResponse{Code:"ACCOUNT_BLOCKED"}`, set `revoked=true`; issue new short-lived JWT access token; return `{ "accessToken": "<jwt>" }`
- [x] 29. Add `Logout` method to `AuthHandler` — JWT-protected; body: `{ refreshToken }`; find `MobileRefreshToken` by token; set `revoked=true`; return HTTP 200
- [x] 30. Add `CreateInvite` method to `OrganizationHandler` in `packages/logstack-go/internal/api/handlers/organization.go` — verify caller is owner or admin; generate secure token (32-byte hex); create `Invite` record with 48h `ExpiresAt`; send invite email via `emailNotifier.SendInviteEmail(ctx, email, orgName, role, inviteURL)`
- [x] 31. Add `GetInvites` method to `OrganizationHandler` — verify caller is owner or admin; return all invites for the org
- [x] 32. Add `RevokeInvite` method to `OrganizationHandler` — verify caller is owner or admin; delete pending invite by ID; return 404 if not found
- [x] 33. Add `AcceptInvite` handler to `AuthHandler` — `GET /v1/auth/accept-invite?token=<t>`; look up invite by token; check `expires_at > NOW()` else return 410 `ErrorResponse{Code:"INVITE_EXPIRED"}`; create `OrganizationMember` record; set invite `status="accepted"`; return 200 with JWT tokens (create/login user if not exists)
- [x] 34. Add `SendInviteEmail` method to `packages/logstack-go/internal/services/notification/email.go` — sends invite email with `inviteURL`, `orgName`, `role`
- [x] 35. Add `GetInvoices` method to `BillingHandler` in `packages/logstack-go/internal/api/handlers/billing.go` — paginated list (`page`, `limit=20`) of invoices for authenticated user ordered by `created_at DESC`; return `{"invoices": [...], "total": N, "page": P}`
- [x] 36. Add `GetInvoice` method to `BillingHandler` — single invoice by ID with ownership check; return HTTP 403 if `user_id` does not match authenticated user
- [x] 37. Update `BillingHandler.HandleWebhook` — on `charge.success` Paystack event, upsert an `Invoice` record: find by `reference`; if not found create with `status="pending"`; set `status="paid"`, `PaidAt=now`; populate `LineItems` from Paystack payload description fields
- [x] 38. Add `Archive` method to `ProjectsHandler` in `packages/logstack-go/internal/api/handlers/projects.go` — set `archived_at = NOW()` on the project; return HTTP 200 with updated project JSON
- [x] 39. Update `ProjectsHandler.List` — add `WHERE archived_at IS NULL` to the default query; skip this filter when `includeArchived=true` query param is present
- [x] 40. Create `packages/logstack-go/internal/api/middleware/feature_matrix.go` — define `FeatureMatrix map[models.SubscriptionTier][]string` with entries for free/starter/pro/enterprise tiers; implement `TierHasFeature(tier models.SubscriptionTier, feature string) bool`
- [x] 41. Create `packages/logstack-go/internal/api/middleware/price_gate.go` — implement `PriceGateMiddleware(db *gorm.DB, feature string) gin.HandlerFunc`; look up user subscription from DB; call `TierHasFeature`; if blocked return HTTP 402 `ErrorResponse{Code:"UPGRADE_REQUIRED", Message:"This feature requires a higher subscription tier.", upgradeUrl:"/checkout"}`
- [x] 42. Create `packages/logstack-go/internal/api/middleware/rbac.go` — implement `RBACMiddleware(db *gorm.DB, requiredRoles ...string) gin.HandlerFunc`; resolve org ID from `:id` URL param; query `OrganizationMember` by `organization_id + user_id`; define role hierarchy `viewer=1, member=2, admin=3, owner=4`; if actual rank < minimum required rank return HTTP 403 `ErrorResponse{Code:"INSUFFICIENT_ROLE"}`; set `orgRole` on gin context
- [x] 43. Update `packages/logstack-go/internal/api/middleware/usage_limit.go` — after computing usage percentage: check 90% threshold with `SETNX usage:warned:90:<userID>:<month>` (TTL = seconds to month end); if key was set (first time), asynchronously call `emailNotifier.SendUsageAlert` with 90% message; at 100% abort with HTTP 429 and set `X-RateLimit-Limit`, `X-RateLimit-Remaining: 0`, `Retry-After` response headers

- [x] 44. Register all new routes in `packages/logstack-go/internal/api/router.go`:
  - `alerts.GET("/options", alertsHandler.GetOptions)` (before `/:id` routes)
  - `projectRoutes.GET("/logs/analytics", projectLogsHandler.Analytics)`
  - `projectRoutes.PATCH("/archive", projectsHandler.Archive)`
  - `protected.POST("/auth/qr/generate", authHandler.GenerateQR)` (JWT-protected — dashboard only)
  - `protected.GET("/auth/qr/:token/status", authHandler.GetQRStatus)` (JWT-protected — web polls)
  - `auth.POST("/qr/:token/confirm", authHandler.ConfirmQR)` (public — mobile QR path)
  - `auth.POST("/qr/pin-confirm", authHandler.ConfirmQRByPIN)` (public — mobile PIN path)
  - `auth.POST("/refresh", authHandler.RefreshMobileToken)` (public — silent mobile refresh)
  - `protected.POST("/auth/logout", authHandler.Logout)` (JWT-protected — revoke refresh token)
  - `auth.GET("/accept-invite", authHandler.AcceptInvite)` (public)
  - `organizations.POST("/:id/invites", orgHandler.CreateInvite)`
  - `organizations.GET("/:id/invites", orgHandler.GetInvites)`
  - `organizations.DELETE("/:id/invites/:inviteId", orgHandler.RevokeInvite)`
  - `billing.GET("/invoices", billingHandler.GetInvoices)`
  - `billing.GET("/invoices/:id", billingHandler.GetInvoice)`
- [x] 45. Apply `RBACMiddleware(cfg.DB, "admin")` to `CreateInvite`, `GetInvites`, `RevokeInvite`, and `UpdateMemberRole` routes in `router.go`
- [x] 46. Apply `PriceGateMiddleware(cfg.DB, "team_management")` to `UpdateMemberRole`, `CreateInvite`, `GetInvites`, and `RevokeInvite` routes in `router.go`

- [x] 47. Update `apps/web/src/types/index.ts` — add `AlertOptions` interface; update `AlertRule` to replace `triggerPattern: string` with `triggerPatterns: string[]` and `channel: AlertChannel` with `channels: string[]`; add `Invoice` interface (`id`, `userId`, `reference`, `amountCents`, `currency`, `status`, `lineItems`, `paidAt`, `createdAt`); add `InvoiceLineItem` interface (`description`, `amount`, `quantity`)
- [x] 48. Refactor `apps/web/src/components/alerts/alert-form.tsx` — add `useQuery` on mount to fetch `GET /v1/alerts/options`; replace channel `Select` with checkbox group rendered from `options.channels`; replace trigger pattern `Input` with checkbox list from `options.triggerPatterns`; replace cooldown number input with `Select` dropdown from `options.cooldownOptions`; show skeleton loaders while loading; submit `channels` and `triggerPatterns` arrays
- [x] 49. Update `apps/web/src/components/alerts/alert-list.tsx` — display `channels` as badge array and `triggerPatterns` as comma-separated tags
- [x] 50. Create `apps/web/src/components/logs/log-analytics.tsx` — props: `projectId: string`; fetch `GET /v1/projects/:id/logs/analytics` via `useQuery`; render 3 stat cards (Total Events, Error Rate %, Warn Count); render `recharts` `AreaChart` for `timeSeries`; show skeleton `Card` placeholders while loading
- [x] 51. Update `apps/web/src/app/(dashboard)/logs/page.tsx` — render `<LogAnalytics projectId={projectId} />` above `<LogFilters />`; invalidate `["log-analytics", projectId]` when filters change
- [x] 52. Create `apps/web/src/hooks/use-org-role.ts` — calls `GET /v1/organizations/me` via TanStack Query; returns the current user's `role` field from org membership
- [x] 53. Update `apps/web/src/app/(dashboard)/settings/team/page.tsx` — fetch `GET /v1/organizations/:id/invites`; add "Pending Invites" section; gate "Invite Member" button with `useOrgRole()` check; "Revoke" calls `DELETE /v1/organizations/:id/invites/:inviteId`
- [x] 54. Create `apps/web/src/app/(auth)/accept-invite/page.tsx` — reads `?token=` from URL; calls `GET /v1/auth/accept-invite?token=<t>`; on success redirects to `/overview` with toast; on error shows friendly message

- [x] 55. Delete `apps/web/src/app/(auth)/login/qr-panel.tsx` if it was created — the QR/PIN flow is a dashboard action only, not a login page feature
- [x] 56. Create `apps/web/src/components/auth/link-mobile-dialog.tsx` — on mount calls `POST /v1/auth/qr/generate`; renders QR code image (left) and large 6-digit PIN labelled "Or enter this PIN on mobile" (right); shows a 10-minute countdown timer; status label "Waiting for mobile app…"; polls `GET /v1/auth/qr/:token/status` every 3 seconds; on `status==="confirmed"` stops polling, shows toast "Mobile app linked!", closes dialog; on 410 shows "Code expired" state with "Regenerate" button; on unmount clears polling interval
- [x] 57. Update dashboard user menu `apps/web/src/components/layout/user-menu.tsx` — add "Link Mobile App" menu item to the authenticated user avatar dropdown; on click opens `<LinkMobileDialog />`; this is the only entry point to the QR/PIN flow on web
- [x] 58. Update `apps/web/src/app/(dashboard)/billing/page.tsx` — replace `TransactionHistory` with invoice list fetching `GET /v1/billing/invoices`; each row is clickable navigating to `/invoice/[id]`; show reference, date, amount, status badge
- [x] 59. Create `apps/web/src/app/(dashboard)/invoice/[id]/page.tsx` — fetch `GET /v1/billing/invoices/:id`; render invoice header, line items table, subtotal/total; "Download PDF" via `window.print()`; show 403/404 error states
- [x] 60. Create `apps/web/src/components/projects/project-card.tsx` — extract card JSX from `projects/page.tsx`; inline rename; archive `AlertDialog`; `UsageProgressBar`; "Manage Members" button
- [x] 61. Update `apps/web/src/app/(dashboard)/projects/page.tsx` — debounced search; `GET /v1/billing/usage`; render `<ProjectCard>`; remove archived on success with toast
- [x] 62. Add `mobile_scanner: ^5.0.0` to `apps/mobile/pubspec.yaml` and run `flutter pub get`
- [x] 63. Add camera permissions to `apps/mobile/android/app/src/main/AndroidManifest.xml` (`CAMERA`) and `apps/mobile/ios/Runner/Info.plist` (`NSCameraUsageDescription`)
- [x] 64. Add `flutter_secure_storage: ^9.0.0` to `apps/mobile/pubspec.yaml`; run `flutter pub get`
- [x] 65. Add `confirmQR`, `confirmQRByPIN`, `refreshAccessToken`, and `revokeRefreshToken` methods to `apps/mobile/lib/services/auth_service.dart` — `confirmQR(token, email, password)` calls `POST /v1/auth/qr/:token/confirm`; `confirmQRByPIN(pin, email, password)` calls `POST /v1/auth/qr/pin-confirm`; `refreshAccessToken(refreshToken)` calls `POST /v1/auth/refresh` returning new accessToken string; `revokeRefreshToken(refreshToken)` calls `POST /v1/auth/logout`
- [x] 66. Create `apps/mobile/lib/screens/auth/qr_scanner_screen.dart` — `MobileScanner` widget; `onDetect` extracts `token` from URL; calls `authService.confirmQR`; on success calls `authProvider.setTokensFromPair` and `context.go('/')`; on error shows inline banner and "Try Again"; shows `CircularProgressIndicator` while confirming
- [x] 67. Create `apps/mobile/lib/screens/auth/pin_login_screen.dart` — 6-digit numeric PIN input; on submit calls `authService.confirmQRByPIN(pin, email, password)`; on success delegates to `authProvider.setTokensFromPair()` and navigates to `'/'`; on error shows inline message with retry
- [x] 68. Update `apps/mobile/lib/providers/auth_provider.dart` — on app launch check secure storage for `refreshToken`; if present call `authService.refreshAccessToken` silently; on 200 update access token and go home without showing login; on 401 clear tokens and go to `LoginScreen`; add `logout()` to call `authService.revokeRefreshToken`, clear storage, reset state; add `setTokensFromPair(TokenPair pair)` if not present
- [x] 69. Update `apps/mobile/lib/screens/auth/login_screen.dart` — add "Scan QR Code" and "Enter PIN" `OutlinedButton`s below sign-in; navigate to `/qr-scanner` and `/pin-login` respectively
- [x] 70. Add routes `/qr-scanner` → `QRScannerScreen` and `/pin-login` → `PINLoginScreen` in `apps/mobile/lib/router.dart`

- [x] 71. Write property-based test for alert rule save/read roundtrip — generate random `triggerPatterns` and `channels` arrays, POST, GET by ID, verify arrays match
- [x] 72. Write property-based test for QR/PIN session expiry — mock Redis TTL elapsed; call both `ConfirmQR` and `ConfirmQRByPIN`; assert HTTP 410 for both paths
- [x] 73. Write property-based test for RBAC enforcement — for each role rank < required, assert HTTP 403 before handler
- [x] 74. Write property-based test for price gate — free-tier user on pro-only route → HTTP 402
- [x] 75. Write property-based test for archive exclusion — archived project never appears in `GET /v1/projects`
- [x] 76. Write property-based test for usage 90% dedup — N ingestion calls crossing 90% → exactly 1 warning email per user per month
- [x] 77. Write property-based test for non-expiring mobile refresh token — valid non-revoked token at any age → HTTP 200; same token with `revoked=true` → HTTP 401

- [x] 78. Run `go build ./...` from `packages/logstack-go` and fix any compile errors
- [x] 79. Run `pnpm build` from `apps/web` and fix any TypeScript errors
- [x] 80. Run `flutter analyze` from `apps/mobile` and resolve any warnings or errors
- [x] 81. Verify all migrations run cleanly in sequence (015→016→017→018→019)
- [x] 82. Update `packages/logstack-go/openapi.yaml` — add entries for all new endpoints including `POST /auth/qr/generate`, `GET /auth/qr/{token}/status`, `POST /auth/qr/{token}/confirm`, `POST /auth/qr/pin-confirm`, `POST /auth/refresh`, `POST /auth/logout`, and all others from wave 4
- [x] 83. Export `LogAnalytics` from `apps/web/src/components/logs/index.ts` and `ProjectCard` from `apps/web/src/components/projects/index.ts`
- [x] 84. Verify end-to-end: open "Link Mobile App" from dashboard user menu → QR + PIN displayed with countdown; scan QR on mobile → linked; enter PIN on mobile → linked; relaunch mobile → lands on home without login prompt; logout → session revoked; also verify invite flow, invoice detail, and project archive

## Notes

- Migrations 015–019 shift numbering to accommodate two ALTER TABLE migrations before the new CREATE TABLE ones. Update any references accordingly.
- `pq.StringArray` requires `github.com/lib/pq` which is already a transitive GORM dependency for PostgreSQL.
- The QR/PIN flow is triggered from the **authenticated dashboard user menu only** — not the login page. `POST /v1/auth/qr/generate` and `GET /v1/auth/qr/:token/status` are JWT-protected. Only the confirm endpoints are public.
- Mobile refresh tokens have no expiry column — they persist until `revoked=true`. This is intentional (WhatsApp-style session persistence). The `flutter_secure_storage` package handles OS-level keychain/keystore encryption on both iOS and Android.
- `window.print()` PDF approach for invoices is a zero-dependency solution. A dedicated PDF library can replace it later without changing the route structure.
- The `UsageLimitMiddleware` 90% email uses `SETNX` for dedup. TTL is set to `time.Until(endOfMonth())` so the key auto-expires allowing a new warning next month.
- PIN is a 6-digit cryptographically random value (not sequential, not derived from token). The `qr:pin:<pin>` reverse-lookup key is deleted on first successful confirm to prevent PIN reuse within the session window.
