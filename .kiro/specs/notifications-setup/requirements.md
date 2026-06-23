# Requirements Document

## Introduction

This document defines the requirements for the Logstack Notifications System — a complete, production-grade notifications infrastructure covering:

1. **Firebase Cloud Messaging (FCM)** push notifications delivered to the Flutter mobile app on iOS (including TestFlight) and Android via the Firebase Admin SDK (HTTP v1 API).
2. **Multi-provider email delivery** with an ordered failover chain: Mailcow (self-hosted, primary) → Brevo → Resend → Zoho, ensuring email delivery even when individual providers are unavailable.
3. **Go backend integration** that routes all notification dispatch through a unified service layer, manages provider health, and stores per-device FCM tokens.

The system builds on the existing `notification` package in `packages/logstack-go` and the existing `NotificationService` in `apps/mobile`. The Flutter app already initialises Firebase in `main.dart` and has `firebase_core`, `firebase_messaging`, and `flutter_local_notifications` in `pubspec.yaml`.

---

## Glossary

- **FCM**: Firebase Cloud Messaging — Google's cross-platform push-notification service.
- **FCM_HTTP_v1**: The current FCM send API (`https://fcm.googleapis.com/v1/projects/{project}/messages:send`) authenticated with a service-account OAuth2 token. Supersedes the deprecated legacy server-key API.
- **Firebase_Admin_SDK**: The Go `firebase.google.com/go/v4` library used on the server to call FCM_HTTP_v1.
- **FlutterFire_CLI**: The `flutterfire` command-line tool that auto-generates `firebase_options.dart` and registers the app with Firebase per platform.
- **APNS**: Apple Push Notification Service — required for FCM delivery on iOS.
- **Push_Token**: A per-device FCM registration token stored in the `push_tokens` database table and managed by the `PushNotifier`.
- **Email_Notifier**: The Go `EmailNotifier` struct in `notification/email.go` responsible for dispatching emails.
- **Provider_Chain**: The ordered list of email providers tried in sequence: Mailcow → Brevo → Resend → Zoho.
- **Mailcow**: The self-hosted SMTP/API email server acting as primary email provider.
- **Brevo**: Transactional email SaaS acting as the first cloud fallback.
- **Resend**: Transactional email SaaS acting as the second cloud fallback.
- **Zoho**: Transactional email SaaS acting as the third (final) cloud fallback.
- **Notification_Service**: The Go `notification.Service` struct in `notification/service.go` that composes `Email_Notifier`, `Push_Notifier`, and `Webhook_Notifier`.
- **NotificationService**: The Flutter singleton in `apps/mobile/lib/services/notification_service.dart`.
- **Alert_Engine**: The existing Go service that evaluates `AlertRule` records and dispatches notifications via `Notification_Service`.
- **Push_Notifier**: The Go `PushNotifier` struct in `notification/push.go`.
- **Background_Handler**: A top-level Dart function registered via `FirebaseMessaging.onBackgroundMessage` that processes FCM messages when the app is not in the foreground.
- **TestFlight**: Apple's beta-distribution platform; iOS devices running TestFlight builds must receive push notifications without a production APNS certificate being required.

---

## Requirements

### Requirement 1: FCM Flutter Client Initialisation

**User Story:** As a mobile developer, I want Firebase and FCM configured correctly in the Flutter app so that push notifications are delivered reliably on iOS and Android, including TestFlight builds.

#### Acceptance Criteria

1. THE `FlutterFire_CLI` SHALL generate a `firebase_options.dart` file in `apps/mobile/lib/` containing `DefaultFirebaseOptions.currentPlatform` for at least the `android` and `ios` platforms of the `general-saas-project` Firebase project.
2. WHEN the Flutter app starts, THE `NotificationService` SHALL call `Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform)` before any Firebase API is used.
3. WHEN the Flutter app starts on iOS, THE `NotificationService` SHALL request `alert`, `badge`, and `sound` permissions using `FirebaseMessaging.requestPermission`.
4. WHEN the Flutter app starts on iOS, THE `NotificationService` SHALL call `FirebaseMessaging.instance.getAPNSToken()` and log a warning if the APNS token is `null` after a 3-second timeout, because FCM on iOS requires an APNS token before an FCM token can be obtained.
5. WHEN the user grants notification permission on iOS, THE `NotificationService` SHALL retrieve the FCM token only after a non-null APNS token is confirmed.
6. WHERE the iOS app is distributed via TestFlight, THE `NotificationService` SHALL use the APNS sandbox environment; the `firebase_options.dart` for iOS SHALL be generated without a release-only restriction so the same binary works on both TestFlight and the App Store.
7. THE `NotificationService` SHALL register a top-level `Background_Handler` function via `FirebaseMessaging.onBackgroundMessage` so that messages are processed when the app is terminated or in the background.
8. WHEN an FCM token is obtained or refreshed, THE `NotificationService` SHALL emit the new token via a `Stream<String>` so other app layers (e.g., the auth flow) can register it with the backend.

---

### Requirement 2: FCM Token Registration with the Backend

**User Story:** As a backend engineer, I want the Flutter app to register and deregister FCM tokens so that the server can target the correct device when sending push notifications.

#### Acceptance Criteria

1. WHEN a user is authenticated and a new FCM token is available, THE `NotificationService` SHALL call `POST /v1/mobile/push-token` with the token and platform (`ios` or `android`) in the request body.
2. WHEN `POST /v1/mobile/push-token` is called, THE Go backend SHALL upsert a `push_tokens` record associating the token with the authenticated user's ID, platform, and a `created_at` / `updated_at` timestamp.
3. WHEN a user logs out, THE Flutter app SHALL call `DELETE /v1/mobile/push-token` with the current token to remove it from the backend.
4. IF the `POST /v1/mobile/push-token` request fails with a network error, THEN THE `NotificationService` SHALL retry the registration up to 3 times with exponential back-off before logging the failure.
5. WHEN the FCM token is refreshed (via `onTokenRefresh`), THE `NotificationService` SHALL automatically call `POST /v1/mobile/push-token` with the new token without requiring user interaction.
6. THE Go backend SHALL enforce a maximum of 10 active `push_tokens` records per user, removing the oldest record when the limit is exceeded.

---

### Requirement 3: Server-Side FCM Push Dispatch

**User Story:** As a backend engineer, I want the Go backend to send FCM push notifications using the HTTP v1 API so that notifications are delivered reliably with proper priority on both iOS and Android.

#### Acceptance Criteria

1. THE `Push_Notifier` SHALL authenticate with FCM using a Firebase service account JSON file whose path is read from the `FCM_SERVICE_ACCOUNT_PATH` environment variable.
2. WHEN the `FCM_SERVICE_ACCOUNT_PATH` environment variable is empty or the file is missing, THE `Push_Notifier` SHALL log a warning and disable push dispatch without causing the backend to fail startup.
3. WHEN an alert is triggered for the `push` channel, THE `Push_Notifier` SHALL send an FCM message via the `Firebase_Admin_SDK` to every `Push_Token` associated with the alert recipient.
4. WHEN sending an FCM message to iOS, THE `Push_Notifier` SHALL set `apns-priority: 10` in the APNS headers and `sound: default` in the APNS payload to ensure foreground and background delivery.
5. WHEN sending an FCM message to Android, THE `Push_Notifier` SHALL set Android message priority to `high` so the message is delivered immediately even when the device is in Doze mode.
6. IF an FCM send call returns a token-not-registered or invalid-registration error, THEN THE `Push_Notifier` SHALL delete the corresponding `push_tokens` record from the database and continue sending to remaining tokens.
7. IF all FCM send calls for a given notification fail, THEN THE `Push_Notifier` SHALL return an error that the `Alert_Engine` can log and surface for observability.
8. THE `Push_Notifier` SHALL include structured log entries for each send attempt containing at minimum: masked token, Firebase message ID (on success), and error detail (on failure).

---

### Requirement 4: Multi-Provider Email Delivery with Failover

**User Story:** As a product owner, I want the email notification system to use multiple providers in a prioritised failover chain so that transactional emails are delivered even when individual providers are down.

#### Acceptance Criteria

1. THE `Email_Notifier` SHALL attempt to deliver every email via the `Provider_Chain` in the fixed order: Mailcow → Brevo → Resend → Zoho.
2. WHEN a provider returns a 4xx or 5xx HTTP status code or a connection/timeout error, THE `Email_Notifier` SHALL log the failure with provider name and status, then attempt the next provider in the chain.
3. WHEN a provider successfully delivers an email (2xx response), THE `Email_Notifier` SHALL log the successful provider name and return without attempting subsequent providers.
4. IF all four providers in the `Provider_Chain` fail to deliver an email, THEN THE `Email_Notifier` SHALL return a combined error listing all provider failures so the caller can handle or retry.
5. THE `Email_Notifier` SHALL read provider credentials from the following environment variables:
   - `MAILCOW_API_KEY` and `MAILCOW_API_URL` for Mailcow
   - `BREVO_API_KEY` for Brevo (existing)
   - `RESEND_API_KEY` for Resend (existing)
   - `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, and `ZOHO_REFRESH_TOKEN` for Zoho
6. WHERE a provider's environment variables are absent or empty, THE `Email_Notifier` SHALL skip that provider silently and move to the next one in the chain, so the system degrades gracefully when not all providers are configured.
7. THE `Email_Notifier` SHALL set a per-provider HTTP timeout of 10 seconds so a slow provider does not stall delivery to subsequent providers.
8. WHEN the `Email_Notifier` is initialised, THE `Email_Notifier` SHALL validate that at least one provider in the `Provider_Chain` has valid credentials; IF no provider is configured, THEN THE `Email_Notifier` SHALL log a warning and all send calls SHALL return a descriptive error.

---

### Requirement 5: Mailcow Primary Email Provider

**User Story:** As a DevOps engineer, I want the system to route emails through the self-hosted Mailcow server first so that we control deliverability and avoid per-email costs on cloud providers.

#### Acceptance Criteria

1. WHEN sending email via Mailcow, THE `Email_Notifier` SHALL call the Mailcow SMTP Relay API endpoint `POST {MAILCOW_API_URL}/api/v1/send/email` with the `X-API-Key` header set to `MAILCOW_API_KEY`.
2. WHEN the Mailcow API returns a 2xx response, THE `Email_Notifier` SHALL treat the send as successful and stop the `Provider_Chain`.
3. IF the Mailcow API is unreachable (connection refused, DNS failure, or timeout), THEN THE `Email_Notifier` SHALL fall through to Brevo within the 10-second timeout budget.
4. THE `Email_Notifier` SHALL send a `From` address of `noreply@logstack.tech` for all Mailcow-delivered messages.

---

### Requirement 6: Brevo Fallback Email Provider

**User Story:** As a DevOps engineer, I want Brevo as the first cloud fallback so that transactional emails are delivered when Mailcow is unavailable.

#### Acceptance Criteria

1. WHEN Mailcow fails and `BREVO_API_KEY` is set, THE `Email_Notifier` SHALL call `POST https://api.brevo.com/v3/smtp/email` with the `api-key` header.
2. WHEN the Brevo API returns a 2xx response, THE `Email_Notifier` SHALL treat the send as successful and stop the `Provider_Chain`.
3. IF the Brevo API returns a non-2xx status, THEN THE `Email_Notifier` SHALL fall through to Resend.

---

### Requirement 7: Resend Fallback Email Provider

**User Story:** As a DevOps engineer, I want Resend as the second cloud fallback so that transactional emails are delivered when both Mailcow and Brevo are unavailable.

#### Acceptance Criteria

1. WHEN Brevo fails and `RESEND_API_KEY` is set, THE `Email_Notifier` SHALL call `POST https://api.resend.com/emails` with the `Authorization: Bearer {RESEND_API_KEY}` header.
2. WHEN the Resend API returns a 2xx response, THE `Email_Notifier` SHALL treat the send as successful and stop the `Provider_Chain`.
3. IF the Resend API returns a non-2xx status, THEN THE `Email_Notifier` SHALL fall through to Zoho.

---

### Requirement 8: Zoho Final Fallback Email Provider

**User Story:** As a DevOps engineer, I want Zoho as the final fallback so that there is always a last-resort email delivery option.

#### Acceptance Criteria

1. WHEN Resend fails and `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, and `ZOHO_REFRESH_TOKEN` are set, THE `Email_Notifier` SHALL obtain a fresh OAuth2 access token from `https://accounts.zoho.com/oauth/v2/token` using the refresh-token grant.
2. WHEN the Zoho access token is obtained, THE `Email_Notifier` SHALL call `POST https://mail.zoho.com/api/accounts/{accountId}/messages` with the `Authorization: Zoho-oauthtoken {token}` header.
3. WHEN the Zoho API returns a 2xx response, THE `Email_Notifier` SHALL treat the send as successful.
4. IF the Zoho API returns a non-2xx status or the token request fails, THEN THE `Email_Notifier` SHALL return the combined error from all four providers.

---

### Requirement 9: Notification Service Wiring and Configuration

**User Story:** As a backend engineer, I want the `Notification_Service` and its providers to be correctly wired in the application startup so that all channels work in every deployment environment.

#### Acceptance Criteria

1. THE `Notification_Service` SHALL be initialised in the application bootstrap (i.e., `main.go`) using all available provider credentials read from the environment.
2. WHEN the Go backend starts, THE `Notification_Service` SHALL log which email providers are active (configured with valid credentials) and whether the `Push_Notifier` is enabled.
3. THE `Notification_Service` SHALL expose a `GetEmailNotifier()` method that returns the configured `Email_Notifier` for use by auth handlers, usage-limit middleware, and organisation handlers.
4. WHEN `FCM_SERVICE_ACCOUNT_PATH` points to a valid service account file, THE `Notification_Service` SHALL initialise the `Push_Notifier` with the `Firebase_Admin_SDK` and log the Firebase project ID.
5. THE `config.Config` struct SHALL include fields for `MailcowAPIKey`, `MailcowAPIURL`, `ResendAPIKey`, `ZohoClientID`, `ZohoClientSecret`, and `ZohoRefreshToken` read from the corresponding environment variables.
6. THE `.env.example` file SHALL document all new environment variables (`MAILCOW_API_KEY`, `MAILCOW_API_URL`, `RESEND_API_KEY`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `FCM_SERVICE_ACCOUNT_PATH`, `FCM_PROJECT_ID`) with clear descriptions and placeholder values.

---

### Requirement 10: End-to-End Notification Delivery Observability

**User Story:** As an operator, I want structured logs and error reporting for all notification dispatch attempts so that I can diagnose delivery failures without inspecting raw email provider dashboards.

#### Acceptance Criteria

1. WHEN any provider in the `Provider_Chain` is attempted, THE `Email_Notifier` SHALL emit a structured log entry at `debug` level containing: provider name, recipient address (masked to `user@***`), and attempt number.
2. WHEN a provider fails, THE `Email_Notifier` SHALL emit a structured log entry at `warn` level containing: provider name, HTTP status or error message, and elapsed time for that attempt.
3. WHEN the final provider in the `Provider_Chain` delivers successfully, THE `Email_Notifier` SHALL emit a structured log entry at `info` level containing: final provider name and total elapsed time across all attempts.
4. WHEN a push notification is delivered, THE `Push_Notifier` SHALL emit a structured log entry at `info` level containing: masked token and Firebase message ID.
5. WHEN a push notification fails, THE `Push_Notifier` SHALL emit a structured log entry at `error` level containing: masked token, error type, and whether the token was removed from the database.
