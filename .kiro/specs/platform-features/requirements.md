# Requirements Document

## Introduction

This document specifies requirements for seven platform features across the Logstack monorepo: a Go (Gin) backend, a Next.js 14 (App Router) web dashboard, and a Flutter mobile app. The features cover alert rule configuration, log analytics and pagination, mobile QR-code login, organization member management with RBAC, checkout and invoicing, project card controls, and backend tier/middleware enforcement. All requirements follow EARS patterns and INCOSE quality rules.

---

## Glossary

- **AlertEngine**: The Go service responsible for evaluating alert rules and dispatching notifications.
- **AlertRule**: A database record that defines when and how a user is notified about log events.
- **AlertChannel**: One of the supported notification delivery methods: `email`, `push`, or `webhook`.
- **TriggerPattern**: A substring or regex pattern matched against log messages to fire an alert.
- **TriggerLevel**: A log severity level (`debug`, `info`, `warn`, `error`, `critical`, `fatal`) used as an alert condition.
- **CooldownMinutes**: The minimum number of minutes that must pass before the same alert rule fires again.
- **LogAnalytics**: Aggregated statistics derived from log events (counts, error rates, time-series data).
- **QRSession**: A short-lived Redis entry keyed by a UUID token, used to coordinate QR-code login between web and mobile.
- **JWT**: JSON Web Token pair (access + refresh) issued upon successful authentication.
- **OrganizationMember**: A join record linking a User to an Organization with a role of `owner`, `admin`, `member`, or `viewer`.
- **RBAC**: Role-Based Access Control — the system that restricts API routes and UI controls based on `OrganizationMember.Role`.
- **Invite**: A pending organization membership record identified by email and a secure token.
- **Invoice**: A record of a completed or pending billing transaction with line items and PDF-ready metadata.
- **SubscriptionTier**: One of `free`, `starter`, `pro`, or `enterprise`.
- **FeatureMatrix**: A static mapping from `SubscriptionTier` to the set of allowed platform features.
- **PriceGate**: A middleware component that blocks access to a feature if the caller's tier does not include it.
- **UsageLimitMiddleware**: The existing Go middleware that enforces monthly log ingestion quotas; to be enhanced with threshold alerting.
- **RBACMiddleware**: A new Go middleware that enforces `OrganizationMember.Role` requirements on protected routes.
- **ArchiveProject**: A soft-delete operation that marks a project as archived without deleting its data.
- **ProjectUsage**: Per-project metrics (current log count vs. plan limit) fetched from `GET /v1/billing/usage`.
- **Paystack**: The payment processor integrated into the billing system.
- **QRCode**: A scannable image encoding the `QRSession` token URL, displayed on the web dashboard login page.
- **APIKeyAuth**: The existing Go middleware that authenticates log ingestion requests via `Authorization: Bearer <api-key>`.
- **JWTAuth**: The existing Go middleware that authenticates dashboard requests via a signed JWT.
- **Hub**: The WebSocket hub managing real-time log streaming connections.
- **Riverpod**: The state-management library used in the Flutter mobile app.
- **GoRouter**: The navigation library used in the Flutter mobile app.
- **TanStack Query**: The data-fetching and caching library used in the Next.js dashboard.

---

## Requirements

### Requirement 1: Alert Rules — Dynamic Channel and Trigger Options

**User Story:** As a developer, I want to configure alert rules using dynamic channel options and trigger patterns fetched from the server, so that the form always reflects the system's current capabilities without hardcoded values.

#### Acceptance Criteria

1. WHEN the AlertForm component mounts, THE AlertForm SHALL fetch available alert channels from `GET /v1/alerts/options` and render each channel as a checkbox.
2. WHEN the AlertForm component mounts, THE AlertForm SHALL fetch available trigger patterns from `GET /v1/alerts/options` and render each pattern as a checkbox, allowing multiple selections.
3. WHEN a user submits the AlertForm with at least one channel and one trigger pattern selected, THE AlertForm SHALL send a `POST /v1/alerts` or `PUT /v1/alerts/:id` request containing the selected channels and patterns.
4. WHEN `GET /v1/alerts/options` is called, THE AlertsHandler SHALL return a JSON object with an `channels` array and a `triggerPatterns` array sourced from the `AlertChannel` constants and a configurable pattern registry.
5. WHEN a user selects the cooldown duration, THE AlertForm SHALL present a dropdown with the options 5, 10, 15, 30, and 60 minutes.
6. WHEN the user saves an alert rule, THE AlertsHandler SHALL persist the selected channels and trigger patterns to the database and return the saved `AlertRule` with HTTP 201 on creation or HTTP 200 on update.
7. IF the `POST /v1/alerts` or `PUT /v1/alerts/:id` request body is missing required fields, THEN THE AlertsHandler SHALL return HTTP 400 with an `ErrorResponse` containing `Code: "VALIDATION_ERROR"`.
8. WHEN an alert rule is saved or updated successfully, THE AlertForm SHALL dismiss the dialog and display a success toast notification.
9. THE AlertRule model SHALL store trigger patterns as a JSON array field (`trigger_patterns jsonb`) instead of a single `TriggerPattern string` field.
10. WHEN `GET /v1/projects/:id/logs/analytics` is called with a valid project ID, THE AnalyticsHandler SHALL return a response within 2000ms under normal load conditions.

---

### Requirement 2: Log Analytics Summary and Server-Side Pagination

**User Story:** As a developer, I want to see an analytics summary at the top of the Logs page and navigate through logs page by page, so that I can quickly assess system health and work with large log volumes efficiently.

#### Acceptance Criteria

1. WHEN a user views the Logs page for a project, THE LogsPage SHALL display an analytics summary section above the log list showing total log count, error rate percentage, and a time-series chart of activity over the last 24 hours.
2. WHEN `GET /v1/projects/:id/logs/analytics` is called with a valid project ID, THE AnalyticsHandler SHALL return a JSON object with: `totalCount` (integer), `countByLevel` (object mapping each `LogLevel` to an integer), `errorRate` (float, percentage), and `timeSeries` (array of hourly buckets for the last 24 hours each containing `timestamp` and `count`).
3. WHEN a user reaches the bottom of the log list and more pages are available, THE LogList SHALL trigger a load-more action fetching the next page from `GET /v1/projects/:id/logs` using `limit` and `offset` query parameters.
4. WHEN `GET /v1/projects/:id/logs` is called with `limit` and `offset` parameters, THE ProjectLogsHandler SHALL return a response containing `logs`, `total`, `offset`, and `hasMore` fields.
5. WHEN pagination parameters are absent from `GET /v1/projects/:id/logs`, THE ProjectLogsHandler SHALL default to `limit=50` and `offset=0`.
6. IF `limit` exceeds 200 in a `GET /v1/projects/:id/logs` request, THEN THE ProjectLogsHandler SHALL cap the limit at 200 and return at most 200 records.
7. WHEN filters (level, search) are applied on the Logs page, THE LogsPage SHALL reset pagination to offset 0 and re-fetch both the analytics and the log list.
8. WHEN the analytics data is loading, THE LogsPage SHALL display skeleton loaders in place of the analytics cards.
9. WHEN `GET /v1/projects/:id/logs/analytics` is called, THE AnalyticsHandler SHALL enforce the same project-ownership check as the existing `RequireProjectOwner` middleware.

---

### Requirement 3: Mobile QR Code Login Flow

**User Story:** As a mobile user, I want to log in by scanning a QR code displayed on the web dashboard, so that I can authenticate my mobile session without re-entering credentials.

#### Acceptance Criteria

1. WHEN the Login screen loads on the mobile app, THE LoginScreen SHALL display both an email/password form and a "Scan QR Code" button.
2. WHEN a user taps "Scan QR Code", THE LoginScreen SHALL navigate to a QR scanner screen that activates the device camera.
3. WHEN `POST /v1/auth/qr/generate` is called by an authenticated web user, THE AuthHandler SHALL create a `QRSession` record in Redis keyed by a UUID token with a 5-minute TTL and return `{ "token": "<uuid>", "qrImageUrl": "<base64-data-url>" }`.
4. WHEN a user views the web dashboard login page, THE WebDashboard SHALL display the QR code image and begin polling `GET /v1/auth/qr/:token/status` every 3 seconds.
5. WHEN the mobile app scans a valid QR code and calls `POST /v1/auth/qr/:token/confirm` with valid mobile credentials, THE AuthHandler SHALL mark the `QRSession` as confirmed in Redis and return a JWT token pair to the mobile caller.
6. WHEN `GET /v1/auth/qr/:token/status` returns `{ "status": "confirmed" }`, THE WebDashboard SHALL stop polling and display an authenticated session.
7. IF a `QRSession` token has expired (TTL elapsed), THEN THE AuthHandler SHALL return HTTP 410 with `ErrorResponse{ Code: "QR_EXPIRED", Message: "QR code has expired. Please generate a new one." }` for both status and confirm endpoints.
8. IF a `POST /v1/auth/qr/:token/confirm` request is made with an already-confirmed token, THEN THE AuthHandler SHALL return HTTP 409 with `ErrorResponse{ Code: "QR_ALREADY_USED", Message: "QR code has already been used." }`.
9. WHEN the mobile app receives a JWT token pair after QR confirmation, THE MobileAuthProvider SHALL store the tokens securely and navigate the user to the home screen.
10. WHEN the QR scanner on mobile encounters a scan error, THE QRScannerScreen SHALL display an inline error message and a "Try Again" button without leaving the scanner screen.

---

### Requirement 4: Member Management and RBAC

**User Story:** As an organization owner or admin, I want to invite team members by email, assign them roles, and enforce those roles across the platform, so that I can control who can view and modify organization resources.

#### Acceptance Criteria

1. WHEN an owner or admin calls `POST /v1/organizations/:id/invites` with a valid email and role, THE OrganizationHandler SHALL create an `Invite` record with a secure token, set its status to `pending`, and send an invitation email to the provided address.
2. WHEN an invited user visits the acceptance URL containing the invite token, THE AuthHandler SHALL validate the token, create an `OrganizationMember` record with the specified role, mark the invite as `accepted`, and redirect the user to the dashboard.
3. IF an invite token has expired (>48 hours), THEN THE AuthHandler SHALL return HTTP 410 with `ErrorResponse{ Code: "INVITE_EXPIRED" }` and instruct the user to request a new invite.
4. WHEN `GET /v1/organizations/:id/invites` is called by an owner or admin, THE OrganizationHandler SHALL return all pending and accepted invites for the organization.
5. WHEN `DELETE /v1/organizations/:id/invites/:inviteId` is called by an owner or admin, THE OrganizationHandler SHALL cancel the pending invite and delete the record.
6. WHILE a user's `OrganizationMember.Role` is `viewer`, THE RBACMiddleware SHALL block any `POST`, `PUT`, `PATCH`, or `DELETE` requests to organization-scoped routes and return HTTP 403 with `ErrorResponse{ Code: "INSUFFICIENT_ROLE" }`.
7. WHILE a user's `OrganizationMember.Role` is `member`, THE RBACMiddleware SHALL allow read and log-ingestion operations but block role-management and billing operations.
8. WHEN an `admin` attempts to modify the role of an `owner`, THE OrganizationHandler SHALL return HTTP 403 with `ErrorResponse{ Code: "CANNOT_MODIFY_OWNER" }`.
9. WHEN a user visits the `/settings/team` page in the Next.js dashboard, THE TeamSettingsPage SHALL display the current member list with names, emails, roles, and an action menu per member.
10. WHEN the current user's role is `owner` or `admin` on the `/settings/team` page, THE TeamSettingsPage SHALL show an "Invite Member" button and allow role changes via a dropdown per member row.
11. WHEN the current user's role is `member` or `viewer` on the `/settings/team` page, THE TeamSettingsPage SHALL hide the "Invite Member" button and render role dropdowns as read-only text.
12. WHEN a pending invite is displayed in the `/settings/team` page, THE TeamSettingsPage SHALL show the invitee's email, the assigned role, and a "Revoke" button visible only to owners and admins.
13. THE RBACMiddleware SHALL be composable with other middleware using the pattern `router.Use(RBACMiddleware("admin"), PriceGateMiddleware("feature"))`.

---

### Requirement 5: Checkout and Invoicing

**User Story:** As a user, I want to select and pay for a subscription plan and view my invoices, so that I can manage my billing from within the dashboard.

#### Acceptance Criteria

1. WHEN a user visits `/checkout`, THE CheckoutPage SHALL fetch pricing tiers from `GET /v1/billing/pricing` and display each tier with its name, description, log limit, features, and price.
2. WHEN a user selects a tier and clicks "Subscribe", THE CheckoutPage SHALL call `POST /v1/billing/initialize` with the selected tier and currency and redirect the user to the returned `authorizationUrl`.
3. IF `POST /v1/billing/initialize` returns an error, THEN THE CheckoutPage SHALL display the error message as a toast notification and keep the user on the page.
4. WHEN a user visits `/billing`, THE BillingPage SHALL display the current subscription tier, status, period dates, and a list of past invoices fetched from `GET /v1/billing/invoices`.
5. WHEN `GET /v1/billing/invoices` is called with a valid JWT, THE BillingHandler SHALL return a paginated list of `Invoice` records for the authenticated user.
6. WHEN a user clicks an invoice row in `/billing`, THE BillingPage SHALL navigate to `/invoice/[id]`.
7. WHEN a user visits `/invoice/[id]`, THE InvoicePage SHALL display invoice number, date, line items, subtotal, tax, total, and a "Download PDF" button.
8. WHEN `GET /v1/billing/invoices/:id` is called, THE BillingHandler SHALL return the full `Invoice` record including line items.
9. IF `GET /v1/billing/invoices/:id` is called for an invoice that does not belong to the authenticated user, THEN THE BillingHandler SHALL return HTTP 403.
10. THE Invoice model SHALL include: `id`, `userId`, `reference`, `amountCents`, `currency`, `status` (`pending` | `paid` | `failed`), `lineItems` (jsonb), `paidAt`, `createdAt`.
11. WHEN a Paystack `charge.success` webhook is received, THE BillingHandler SHALL create or update an `Invoice` record and set its status to `paid`.

---

### Requirement 6: Project Card Controls

**User Story:** As a user, I want to search, filter, and manage my projects from the projects dashboard, so that I can quickly find projects and perform administrative actions like renaming or archiving.

#### Acceptance Criteria

1. WHEN a user views the `/projects` page with at least one project, THE ProjectsPage SHALL display a search/filter input above the project grid.
2. WHEN a user types in the search input on the `/projects` page, THE ProjectsPage SHALL filter the displayed project cards client-side by project name in real time (within 300ms of the last keystroke).
3. WHEN a project card is rendered, THE ProjectCardComponent SHALL display current usage (log count this month) and the plan limit side by side, fetched from `GET /v1/billing/usage`.
4. WHEN a user clicks "Edit Name" on a project card, THE ProjectCardComponent SHALL display an inline text input pre-filled with the current project name and a save button.
5. WHEN a user saves an edited project name via the inline input, THE ProjectCardComponent SHALL call `PUT /v1/projects/:id` with the new name, optimistically update the card, and revert on error.
6. WHEN a user clicks "Archive" on a project card, THE ProjectCardComponent SHALL display a confirmation dialog before calling `PATCH /v1/projects/:id/archive`.
7. WHEN `PATCH /v1/projects/:id/archive` is called, THE ProjectsHandler SHALL set an `archived_at` timestamp on the project record and return HTTP 200 with the updated project.
8. WHEN a project is archived, THE ProjectsPage SHALL remove the card from the active project grid and show a toast: "Project archived".
9. WHEN a user clicks "Manage Members" on a project card, THE ProjectCardComponent SHALL navigate to `/settings/team?projectId=<id>`.
10. WHEN `GET /v1/projects` is called, THE ProjectsHandler SHALL exclude projects where `archived_at IS NOT NULL` from the default response unless the `includeArchived=true` query parameter is present.
11. THE ProjectsHandler SHALL only allow `PATCH /v1/projects/:id/archive` for the project owner (enforced via `RequireProjectOwner` middleware).

---

### Requirement 7: Price Gate, Tier Middleware, and Enhanced Usage Limits

**User Story:** As a platform operator, I want composable Go middleware that enforces subscription tier feature access, RBAC role requirements, and usage thresholds, so that features are gated correctly and users are notified before they hit their limits.

#### Acceptance Criteria

1. WHEN a request arrives at a route protected by `PriceGateMiddleware("feature")`, THE PriceGateMiddleware SHALL look up the caller's `SubscriptionTier` and check the `FeatureMatrix` to determine if the feature is included.
2. IF the caller's tier does not include the requested feature, THEN THE PriceGateMiddleware SHALL abort with HTTP 402 and `ErrorResponse{ Code: "UPGRADE_REQUIRED", Message: "This feature requires a higher subscription tier.", "upgradeUrl": "/checkout" }`.
3. THE FeatureMatrix SHALL map each `SubscriptionTier` to a set of feature strings; at minimum it SHALL define: `free → ["basic_alerts", "email_alerts"]`, `starter → ["basic_alerts", "email_alerts", "webhook_alerts", "advanced_filters"]`, `pro → ["basic_alerts", "email_alerts", "webhook_alerts", "advanced_filters", "advanced_alerts", "team_management"]`, `enterprise → [all features]`.
4. WHEN a request arrives at a route protected by `RBACMiddleware("admin")`, THE RBACMiddleware SHALL resolve the calling user's `OrganizationMember.Role` from the database (or Redis cache) and allow the request only if the role is `admin` or `owner`.
5. IF the calling user has no `OrganizationMember` record for the organization associated with the request, THEN THE RBACMiddleware SHALL return HTTP 403 with `ErrorResponse{ Code: "NOT_A_MEMBER" }`.
6. WHEN the `UsageLimitMiddleware` processes a log ingestion request and the current usage reaches 90% of the tier limit, THE UsageLimitMiddleware SHALL publish an alert event that triggers a warning email to the project owner.
7. WHEN the `UsageLimitMiddleware` processes a log ingestion request and the current usage reaches 100% of the tier limit, THE UsageLimitMiddleware SHALL abort the request with HTTP 429 and set the `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` response headers.
8. WHEN the 90% threshold email is sent, THE UsageLimitMiddleware SHALL set a Redis key `usage:warned:90:<userID>:<month>` with a TTL equal to the remaining seconds in the current month to prevent duplicate warning emails.
9. THE middleware components SHALL be composable in a single `router.Use(...)` call without requiring changes to handler logic.
10. WHEN `GET /v1/projects/:id` is called for an archived project, THE ProjectsHandler SHALL return the project data including the `archivedAt` field.
11. THE Go backend SHALL include migration `015_create_invites.up.sql` creating the `invites` table with columns: `id uuid PRIMARY KEY`, `organization_id uuid NOT NULL REFERENCES organizations(id)`, `email varchar(255) NOT NULL`, `role varchar(50) NOT NULL`, `token varchar(255) UNIQUE NOT NULL`, `status varchar(20) NOT NULL DEFAULT 'pending'`, `expires_at timestamptz NOT NULL`, `created_at timestamptz NOT NULL DEFAULT NOW()`.
12. THE Go backend SHALL include migration `016_create_invoices.up.sql` creating the `invoices` table with columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id integer NOT NULL REFERENCES users(id)`, `reference varchar(255) UNIQUE NOT NULL`, `amount_cents integer NOT NULL`, `currency varchar(3) NOT NULL`, `status varchar(20) NOT NULL DEFAULT 'pending'`, `line_items jsonb NOT NULL DEFAULT '[]'`, `paid_at timestamptz`, `created_at timestamptz NOT NULL DEFAULT NOW()`, `updated_at timestamptz NOT NULL DEFAULT NOW()`.
