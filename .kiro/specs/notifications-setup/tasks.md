# Implementation Plan: Logstack Notifications System

## Overview

Implements the full notifications infrastructure for Logstack: multi-provider email failover (Mailcow → Brevo → Resend → Zoho), FCM push dispatch improvements, Flutter APNS token gating with token stream, and backend registration/deregistration. Tasks are ordered so that config changes land first, Go backend work follows, and Flutter changes come last — each task building on the previous so nothing is left unwired.

---

## Tasks

- [x] 1. Extend `config.go` and `.env.example` with new provider environment variables
  - [x] 1.1 Add new fields to `config.Config` struct and `Load()` in `packages/logstack-go/internal/config/config.go`
    - Add `MailcowAPIKey string`, `MailcowAPIURL string`, `ResendAPIKey string`, `ZohoClientID string`, `ZohoClientSecret string`, `ZohoRefreshToken string` to the `Config` struct
    - Add the corresponding `getEnv(...)` calls inside `Load()` under the "External services" block
    - Do **not** add validation failures for these fields — graceful degradation is handled in `EmailNotifier`
    - _Requirements: 9.5_

  - [x] 1.2 Write unit tests for new config fields
    - Test that each new field is populated when the corresponding env var is set
    - Test that missing vars leave the field as an empty string without returning an error from `Load()`
    - File: `packages/logstack-go/internal/config/config_test.go`
    - _Requirements: 9.5_

  - [x] 1.3 Update `.env.example` with new email provider and FCM variables
    - Add a new `EMAIL NOTIFICATIONS` section documenting `MAILCOW_API_KEY`, `MAILCOW_API_URL`, `BREVO_API_KEY`, `RESEND_API_KEY`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` with placeholder values and comments
    - Update the existing `PUSH NOTIFICATIONS` section to replace `FCM_SERVER_KEY` with `FCM_SERVICE_ACCOUNT_PATH` and `FCM_PROJECT_ID`
    - _Requirements: 9.6_

- [x] 2. Refactor `email.go` to the multi-provider strategy pattern
  - [x] 2.1 Define `EmailProvider` interface and update `EmailNotifier` struct
    - Add `EmailProvider` interface with `Name() string`, `IsConfigured() bool`, `Send(ctx, to, toName, subject, htmlBody string) error`
    - Replace the single `apiKey` field on `EmailNotifier` with `providers []EmailProvider` and a shared `baseURL string`
    - File: `packages/logstack-go/internal/services/notification/email.go`
    - _Requirements: 4.1, 9.5_

  - [x] 2.2 Implement `mailcowProvider` struct
    - Fields: `apiKey string`, `apiURL string`, `client *http.Client` (timeout 10s)
    - `IsConfigured()` returns true when both `apiKey` and `apiURL` are non-empty
    - `Send()` calls `POST {apiURL}/api/v1/send/email` with `X-API-Key` header and `From: noreply@logstack.tech`
    - Parse response: expect JSON array where first element has `"type":"success"`; any other body or non-2xx is a failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 4.7_

  - [x] 2.3 Implement `brevoProvider` struct
    - Fields: `apiKey string`, `client *http.Client` (timeout 10s)
    - `IsConfigured()` returns true when `apiKey` is non-empty
    - `Send()` calls `POST https://api.brevo.com/v3/smtp/email` with `api-key` header
    - Parse response: expect HTTP 201 with `{"messageId":"..."}` body; anything else is a failure
    - _Requirements: 6.1, 6.2, 6.3, 4.7_

  - [x] 2.4 Implement `resendProvider` struct
    - Fields: `apiKey string`, `client *http.Client` (timeout 10s)
    - `IsConfigured()` returns true when `apiKey` is non-empty
    - `Send()` calls `POST https://api.resend.com/emails` with `Authorization: Bearer {apiKey}` header
    - Parse response: expect HTTP 200 with `{"id":"..."}` body; anything else is a failure
    - _Requirements: 7.1, 7.2, 7.3, 4.7_

  - [x] 2.5 Implement `zohoProvider` struct
    - Fields: `clientID string`, `clientSecret string`, `refreshToken string`, `client *http.Client` (timeout 10s)
    - `IsConfigured()` returns true when all three Zoho fields are non-empty
    - `Send()` first calls `POST https://accounts.zoho.com/oauth/v2/token` with refresh-token grant to get a fresh access token
    - Then calls `POST https://mail.zoho.com/api/accounts/{accountId}/messages` with `Authorization: Zoho-oauthtoken {token}` header
    - Parse response: expect HTTP 200 with `{"status":{"code":200}}`; token failure or bad body is a failure
    - Define `zohoTokenResponse` struct: `AccessToken`, `ExpiresIn`, `TokenType`, `Error` fields
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 4.7_

  - [x] 2.6 Implement the provider chain executor in `EmailNotifier.sendEmail()`
    - Replace the existing `sendEmail` method signature to accept `ctx context.Context`
    - Iterate `e.providers`, skip unconfigured ones, call each `p.Send()` inside the loop
    - Log `slog.Debug` before each attempt (provider name, `maskEmail(to)`, attempt number)
    - Log `slog.Warn` on each failure (provider name, error, elapsed time)
    - Log `slog.Info` on success (provider name, total elapsed time) and return `nil` immediately
    - If all providers fail, return combined error: `"all email providers failed: <p1>: <err>; <p2>: <err>; ..."`
    - If no providers are configured, return error immediately without network I/O
    - Add `maskEmail(addr string) string` helper that returns `localPart@***`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 10.1, 10.2, 10.3_

  - [x] 2.7 Update `NewEmailNotifier` to accept `*config.Config` and construct the provider chain
    - Build `providers` slice: append each provider struct (mailcow, brevo, resend, zoho) in fixed order using values from `cfg`
    - At construction time, count configured providers and log `slog.Warn` if zero are configured
    - Update all call sites in `service.go` to pass `cfg` instead of `brevoAPIKey`
    - _Requirements: 4.8, 9.2_

  - [x] 2.8 Write property test for email provider chain ordering and failover (Property 8)
    - **Property 8: Email Provider Chain Ordering and Failover**
    - **Validates: Requirements 4.1, 4.2**
    - Use `pgregory.net/rapid` to generate random combinations of provider failure modes (4xx, 5xx, 3xx, timeout, 2xx-with-error-body) for each of the four providers
    - Assert the call order is always Mailcow → Brevo → Resend → Zoho and a failure on provider N always leads to an attempt on provider N+1 (when configured)
    - File: `packages/logstack-go/internal/services/notification/email_test.go`

  - [x] 2.9 Write property test for provider success short-circuits the chain (Property 9)
    - **Property 9: Provider Success Short-Circuits the Chain**
    - **Validates: Requirements 4.3, 4.4**
    - Generate random provider index N that succeeds; assert providers N+1..3 are never called
    - File: `packages/logstack-go/internal/services/notification/email_test.go`

  - [x] 2.10 Write property test for combined error on total failure (Property 10)
    - **Property 10: Combined Error on Total Failure**
    - **Validates: Requirement 4.5**
    - Generate a set of failing providers and assert the returned error string contains each provider's name and error message
    - File: `packages/logstack-go/internal/services/notification/email_test.go`

  - [x] 2.11 Write property test for only configured providers are attempted (Property 11)
    - **Property 11: Only Configured Providers Are Attempted**
    - **Validates: Requirement 4.6**
    - Use `rapid` to generate subsets S ⊆ {mailcow, brevo, resend, zoho}; assert exactly |S| providers are attempted, unconfigured ones are skipped silently
    - File: `packages/logstack-go/internal/services/notification/email_test.go`

  - [x] 2.12 Write property test for no-provider send returns error without network I/O (Property 12)
    - **Property 12: No-Provider Send Returns Error Without Network I/O**
    - **Validates: Requirement 4.8**
    - Assert that when all providers are unconfigured, `sendEmail` returns an error and no HTTP requests are made
    - File: `packages/logstack-go/internal/services/notification/email_test.go`

  - [x] 2.13 Write property test for Zoho OAuth token obtained before send (Property 13)
    - **Property 13: Zoho OAuth Token Obtained Before Send**
    - **Validates: Requirements 8.1, 8.2**
    - Generate arbitrary email payloads; assert that when Zoho is reached, the OAuth token endpoint is called before the messages endpoint
    - File: `packages/logstack-go/internal/services/notification/email_test.go`

  - [x] 2.14 Write property test for email provider attempt structured logging (Property 14)
    - **Property 14: Email Provider Attempt Structured Logging**
    - **Validates: Requirements 10.1, 10.2, 10.3**
    - Use `rapid` to generate send scenarios; capture `slog` output via a test handler; assert debug entries exist per attempt, warn entries exist per failure, and an info entry exists on success — each with the required fields
    - File: `packages/logstack-go/internal/services/notification/email_test.go`

- [x] 3. Update `push.go` with invalid-token cleanup
  - [x] 3.1 Add invalid-token detection and DB deletion inside `PushNotifier.Send()` loop
    - Import `"firebase.google.com/go/v4/messaging"` (already available)
    - After `p.client.Send()` returns an error, check `messaging.IsRegistrationTokenNotRegistered(err)` or `messaging.IsInvalidArgument(err)`
    - If either is true: call `p.db.Where("token = ?", token.Token).Delete(&models.PushToken{})` and log `slog.Warn` with `token_removed: true`
    - For all other errors: log `slog.Error` with `token_removed: false`
    - File: `packages/logstack-go/internal/services/notification/push.go`
    - _Requirements: 3.6, 3.8, 10.5_

  - [x] 3.2 Write property test for invalid token cleanup (Property 6)
    - **Property 6: Invalid Token Cleanup**
    - **Validates: Requirement 3.6**
    - Use `rapid` to generate sets of tokens where a random subset triggers `IsRegistrationTokenNotRegistered` errors; assert those tokens are absent from the DB after `Send()` completes and the remaining tokens are untouched
    - File: `packages/logstack-go/internal/services/notification/push_test.go`

  - [x] 3.3 Write property test for FCM send attempts match token count (Property 4)
    - **Property 4: FCM Send Attempts Match Token Count**
    - **Validates: Requirement 3.3**
    - Use `rapid` to generate N tokens (1 ≤ N ≤ 10) for a user; assert exactly N `Send()` calls are made to the Firebase client
    - File: `packages/logstack-go/internal/services/notification/push_test.go`

  - [x] 3.4 Write property test for FCM message payload structure (Property 5)
    - **Property 5: FCM Message Payload Structure**
    - **Validates: Requirements 3.4, 3.5**
    - Use `rapid` to generate arbitrary `AlertRule` and `Log` values; assert that for every constructed `messaging.Message`, `APNS.Headers["apns-priority"] == "10"`, `APNS.Payload.Aps.Sound == "default"`, and `Android.Priority == "high"`
    - File: `packages/logstack-go/internal/services/notification/push_test.go`

  - [x] 3.5 Write property test for push notification structured logging (Property 7)
    - **Property 7: Push Notification Structured Logging**
    - **Validates: Requirements 3.8, 10.4, 10.5**
    - Use `rapid` to generate send scenarios (mixed success/failure); capture log output and assert each log entry contains a masked token, plus message ID on success or error detail + `token_removed` on failure
    - File: `packages/logstack-go/internal/services/notification/push_test.go`

- [x] 4. Enforce 10-token cap in `push_tokens.go`
  - [x] 4.1 Add per-user token count check and oldest-token eviction before each insert in `RegisterPushToken`
    - After confirming the token is new (the existing-token update path is unchanged), count existing tokens: `h.db.Model(&models.PushToken{}).Where("user_id = ?", userID).Count(&tokenCount)`
    - If `tokenCount >= 10`: query `h.db.Where("user_id = ?", userID).Order("created_at ASC").First(&oldest)` and `h.db.Delete(&oldest)`
    - Proceed with `h.db.Create(&token)` as before
    - File: `packages/logstack-go/internal/api/handlers/mobile/push_tokens.go`
    - _Requirements: 2.6_

  - [x] 4.2 Write property test for push token cap invariant (Property 3)
    - **Property 3: Push Token Cap Invariant**
    - **Validates: Requirement 2.6**
    - Use `rapid` to generate sequences of `RegisterPushToken` calls (arbitrary lengths, arbitrary tokens) against a test DB; after every call assert `COUNT(*) WHERE user_id = ?` ≤ 10
    - Assert that when a new token triggers eviction, the remaining record has the earliest `created_at` among pre-eviction records
    - File: `packages/logstack-go/internal/api/handlers/mobile/push_tokens_test.go`

- [x] 5. Update `service.go` — constructor and startup logging
  - [x] 5.1 Refactor `NewNotificationService` and `NewNotificationServiceWithDB` to accept `*config.Config`
    - Replace individual string parameters with a single `cfg *config.Config` parameter
    - Pass `cfg` to `NewEmailNotifier(cfg, cfg.BaseURL)` and `NewPushNotifier(cfg.FCMServiceAccountPath, cfg.FCMProjectID, db)`
    - After constructing the push notifier, log `slog.Info` with the Firebase project ID when push is enabled, or `slog.Warn` when it is disabled
    - File: `packages/logstack-go/internal/services/notification/service.go`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 5.2 Update all call sites of `NewNotificationService` / `NewNotificationServiceWithDB` in `cmd/` or `main.go` to pass `cfg`
    - Locate the bootstrap code that calls either constructor and update the argument list
    - Verify the app compiles after the change
    - _Requirements: 9.1_

- [x] 6. Checkpoint — ensure Go backend compiles and all existing tests pass
  - Run `go build ./...` in `packages/logstack-go`; ensure no compile errors
  - Run `go test ./internal/services/notification/... ./internal/api/handlers/mobile/... ./internal/config/...`
  - Ensure all tests pass; ask the user if questions arise.

- [x] 7. Update Flutter `notification_service.dart`
  - [x] 7.1 Add `StreamController<String>` and `tokenStream` getter
    - Add `final _tokenController = StreamController<String>.broadcast()` field
    - Add `Stream<String> get tokenStream => _tokenController.stream`
    - Add `void dispose()` method that calls `_tokenController.close()`
    - File: `apps/mobile/lib/services/notification_service.dart`
    - _Requirements: 1.8_

  - [x] 7.2 Register top-level background handler
    - Add top-level function `@pragma('vm:entry-point') Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message)` that calls `Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform)` before any processing
    - In `initialize()`, call `FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler)` as the very first statement before `requestPermission`
    - File: `apps/mobile/lib/services/notification_service.dart`
    - _Requirements: 1.7_

  - [x] 7.3 Implement APNS token gating in `_initializeFCM()`
    - Wrap the existing `getToken()` call: on iOS, first call `_messaging.getAPNSToken().timeout(const Duration(seconds: 3))` inside a try-catch
    - If the APNS token is null (or the Future times out), log a warning and return early without calling `getToken()`
    - If the APNS token is non-null (or platform is Android), call `getToken()`, then emit the result via `_tokenController.add(token)`
    - Wire `onTokenRefresh` to also emit via `_tokenController.add(token)`
    - File: `apps/mobile/lib/services/notification_service.dart`
    - _Requirements: 1.4, 1.5, 1.8_

  - [x] 7.4 Write property test for FCM token stream emission (Property 1)
    - **Property 1: FCM Token Stream Emission**
    - **Validates: Requirement 1.8**
    - Use `package:rapid` to generate arbitrary FCM token strings; simulate token availability in `_initializeFCM()` using mocks; assert `tokenStream` emits each generated token unchanged
    - File: `apps/mobile/test/notification_service_test.dart`

  - [x] 7.5 Write property test for APNS token precedes FCM token on iOS (Property 15)
    - **Property 15: APNS Token Precedes FCM Token on iOS**
    - **Validates: Requirements 1.4, 1.5**
    - Use `package:rapid` to generate scenarios (APNS null / non-null, timeout / no-timeout); assert that `getToken()` is never called when APNS is null or times out, and is always called when APNS is non-null
    - File: `apps/mobile/test/notification_service_test.dart`

- [x] 8. Update Flutter `auth_provider.dart` — token registration and deregistration
  - [x] 8.1 Add FCM token stream subscription and `_registerPushToken` retry logic
    - Add fields `StreamSubscription<String>? _tokenSubscription` and `String? _currentFcmToken` to `AuthNotifier`
    - Implement `_listenForFcmToken(ApiClient apiClient)` that subscribes to `NotificationService.instance.tokenStream` and calls `_registerPushToken` on each emission; also register the already-available token synchronously
    - Implement `_registerPushToken(ApiClient apiClient, String token)` with a `for` loop up to `maxRetries = 3`, calling `apiClient.post('/mobile/push-token', data: {'token': token, 'deviceType': Platform.isIOS ? 'ios' : 'android'})` with `await Future.delayed(Duration(seconds: 1 << attempt))` on failure (delays: 1s, 2s)
    - Call `_listenForFcmToken(apiClient)` at the end of `login()` and `signup()` after the state is set to authenticated
    - File: `apps/mobile/lib/providers/auth_provider.dart`
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 8.2 Add push token deregistration on logout
    - In `logout()`, before calling `_authService.logout()`, attempt `apiClient.delete('/mobile/push-token?token=${_currentFcmToken}')` when `_currentFcmToken` is non-null; swallow any errors (best-effort)
    - Cancel `_tokenSubscription` and null out `_currentFcmToken` after deregistration attempt
    - File: `apps/mobile/lib/providers/auth_provider.dart`
    - _Requirements: 2.3_

  - [x] 8.3 Write property test for push token registration retry backoff (Property 2)
    - **Property 2: Push Token Registration Retry Backoff**
    - **Validates: Requirement 2.4**
    - Use `package:rapid` to generate failure counts in [1, 3]; verify retry delays are exactly 1s, 2s before each retry attempt and no further attempt is made after the 3rd failure
    - File: `apps/mobile/test/auth_provider_test.dart`

- [x] 9. Final checkpoint — ensure all tests pass
  - Run `go test ./...` in `packages/logstack-go`
  - Run `flutter test` in `apps/mobile`
  - Ensure all tests pass; ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Config changes (Task 1) must land before any Go notification code compiles
- Email provider structs (Task 2.2–2.5) are all in `email.go`; they can be implemented in parallel since they share only the `EmailProvider` interface
- `service.go` constructor changes (Task 5) depend on `email.go` and `push.go` being complete first
- Flutter tasks (7 and 8) are independent of the Go tasks — they can be started any time after Task 1.3 (`.env.example`) is done
- `package:rapid` must be added to `dev_dependencies` in `apps/mobile/pubspec.yaml` before Dart property tests run
- Property tests use `pgregory.net/rapid` for Go (already referenced in design) — add to `go.mod` if not present: `go get pgregory.net/rapid`
- Firebase setup (FlutterFire CLI, APNS key, service account) documented in `design.md § Firebase Setup Guide` must be completed before end-to-end testing

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.1", "4.1", "7.1", "7.2"] },
    { "id": 3, "tasks": ["2.6", "3.2", "3.3", "3.4", "3.5", "4.2", "7.3", "8.1"] },
    { "id": 4, "tasks": ["2.7", "2.8", "2.9", "2.10", "2.11", "2.12", "2.13", "2.14", "7.4", "7.5", "8.2"] },
    { "id": 5, "tasks": ["5.1", "8.3"] },
    { "id": 6, "tasks": ["5.2"] }
  ]
}
```
