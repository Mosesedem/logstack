# Escalation Email, Notification Deep-Linking & Email Limits

> **Date:** 2026-07-13  
> **Scope:** Go backend, Next.js web app, Flutter mobile app

---

## Overview

This changeset adds four features across the full stack:

1. **Swipe-to-refresh** on the mobile logs screen  
2. **Push notification deep-linking** to open log detail screens  
3. **Escalation email settings** on both web and mobile  
4. **Monthly email limit (100/month)** for free-tier users  

---

## 1. Swipe-to-Refresh (Flutter)

**File:** `apps/mobile/lib/screens/logs/logs_screen.dart`

- Wrapped the empty-state and error-state views inside a scrollable `ListView` with `AlwaysScrollableScrollPhysics`, placed within a `RefreshIndicator`.  
- The existing data-loaded `ListView.builder` also received `AlwaysScrollableScrollPhysics` so that swipe-to-refresh works even when the list is shorter than the viewport.

---

## 2. Push Notification Deep-Linking (Flutter)

**Files changed:**
- `apps/mobile/lib/router.dart` — Added a global `rootNavigatorKey` and attached it to `GoRouter.navigatorKey`.
- `apps/mobile/lib/services/notification_service.dart` — Imported `dart:convert`, `go_router`, and `router.dart`.

**How it works:**

1. When a foreground local notification is shown, the payload is now serialized as `jsonEncode(message.data)` (previously used `.toString()`, which was not parseable).
2. A shared `_navigateToLogDetail(Map<String, dynamic> data)` method extracts `logId` from the notification payload and calls `GoRouter.of(context).push('/logs/$logId')` using `rootNavigatorKey.currentContext`.
3. Three tap handlers route through it:
   - `_handleMessageOpenedApp` — FCM notification tapped while app was backgrounded.
   - `_handleInitialMessage` — FCM notification that cold-launched the app.
   - `_onNotificationTapped` — Local notification tapped (decodes JSON payload first).

**Backend requirement:** Push notification payloads sent from the server must include a `logId` key in `data` for deep-linking to work.

---

## 3. Escalation Email Settings

### 3a. Database Migration (Go)

**File:** `packages/logstack-go/internal/db/migrations.go`

- Added migration `026_add_escalation_email_to_users`:
  ```sql
  ALTER TABLE users ADD COLUMN IF NOT EXISTS escalation_email TEXT DEFAULT '';
  ```
- Bumped `autoMigrateVersion` to `"automigrate_v5"` to trigger GORM auto-schema sync.

### 3b. User Model & API (Go)

**Files:**
- `packages/logstack-go/internal/models/user.go` — Added `EscalationEmail string` field (column `escalation_email`) to `User` struct and `UserResponse`.
- `packages/logstack-go/internal/api/handlers/users.go` — `UpdateCurrentUser` (`PUT /v1/users/me`) now accepts and persists `escalationEmail`.

### 3c. Escalation Handler (Go)

**File:** `packages/logstack-go/internal/api/handlers/logs.go`

The `Escalate` handler (`POST /v1/projects/:id/logs/:logId/escalate`) now:

1. Preloads the project `Owner` with their `EscalationEmail`.
2. Checks the monthly email limit via `CheckAndIncrementEmailLimit`.
3. Builds a formatted HTML email containing log metadata (level, message, source, timestamp, deep-link).
4. Sends via `EmailNotifier.SendStandard` to the escalation email (falls back to the owner's primary email if empty).

### 3d. Web Settings (Next.js)

**Files:**
- `apps/web/src/types/index.ts` — Added `escalationEmail?: string` to `User` interface.
- `packages/shared-types/src/index.ts` — Added `escalationEmail?: string` to shared `User` type.
- `apps/web/src/app/(dashboard)/settings/page.tsx` — Added `escalationEmail` state, wired it into `updateProfileMutation`, loaded it from user data in `useEffect`, and rendered a labeled text input in the profile card.

### 3e. Mobile Settings (Flutter)

**Files:**
- `apps/mobile/lib/models/user.dart` — Added `String? escalationEmail` field to freezed `User` class.
- `apps/mobile/lib/models/user.freezed.dart` — Updated generated code to include `escalationEmail` in copyWith, equality, hashCode, toString, constructors.
- `apps/mobile/lib/models/user.g.dart` — Updated JSON serialization to read/write `escalationEmail`.
- `apps/mobile/lib/services/auth_service.dart` — Added `updateProfile({String? escalationEmail})` method that sends `PUT /users/me`.
- `apps/mobile/lib/screens/settings/settings_screen.dart` — Added an **Escalation** section between Notifications and Account with:
  - A `_SectionHeader` (warning icon, title, subtitle).
  - An `_EscalationSettingsCard` widget:
    - Loads the current escalation email from the API.
    - Validates email format (optional — empty is allowed).
    - Saves changes via `AuthService.updateProfile`.
    - Shows a snackbar on success/failure.
    - Save button is disabled until the value changes.

---

## 4. Monthly Email Limit for Free Users

### 4a. Notification Service (Go)

**File:** `packages/logstack-go/internal/services/notification/service.go`

- `Service` struct now holds a `*gorm.DB` and `*redis.Client`.
- `NewNotificationServiceWithDB` constructor accepts and stores both.
- New method `CheckAndIncrementEmailLimit(userID uint) error`:
  1. Looks up the user's subscription tier from the database.
  2. If tier is `"free"`, checks a Redis counter key `email_limit:<YYYY-MM>:<userID>`.
  3. If the count is ≥ 100, returns an error (`monthly email limit reached`).
  4. Otherwise increments the counter and sets a 32-day TTL.
  5. Non-free tiers pass through without limit.
- `sendChannel` for `AlertChannelEmail` calls `CheckAndIncrementEmailLimit` before sending; if the limit is exceeded the email is silently skipped (logged as a warning).

### 4b. Redis Key in main.go

**File:** `packages/logstack-go/cmd/server/main.go`

- The existing `rdb` Redis client is passed to `NewNotificationServiceWithDB` alongside the GORM `db`.

---

## API Contract

### `PUT /v1/users/me`

**Request body** (only changed fields):
```json
{
  "escalationEmail": "ops-team@example.com"
}
```

**Response:** Full `UserResponse` object including the updated `escalationEmail`.

### `POST /v1/projects/:id/logs/:logId/escalate`

Now sends an HTML email to the project owner's `escalation_email` (or primary `email` as fallback). Subject to the 100/month email limit for free-tier users.

---

## Notes

- Run `dart run build_runner build --delete-conflicting-outputs` in `apps/mobile/` after pulling these changes to regenerate freezed files (the generated files have been manually updated in this changeset).
- The Redis email-limit keys expire automatically after 32 days, so no cleanup is needed.
