---
name: logstack-mobile-ux
description: >
  End-to-end guide for Logstack Flutter mobile companion app UX: live stream
  connection status, session security (PIN reset on logout), onboarding splash,
  push permission gate, app lock (PIN, biometrics, lock modes), project picker,
  settings navigation, loading states, and store builds. Use when working on
  apps/mobile connection banner flicker, offline/cached log states, PIN lifecycle,
  design polish, iOS back navigation, splash/onboarding, app lock, or when the
  user runs /logstack-mobile-ux.
---

# Logstack Mobile UX

Companion app only — PIN/QR/email link, view logs, escalate, settings. No account creation on device.

## Architecture

- Entry: `lib/main.dart` → `LogstackApp` → `AppLockGate` (inside `MaterialApp.router` builder) → router
- Router: `lib/router.dart` — onboarding, auth, post-login security gate, `ShellRoute` with `HomeScreen`
- Security: `app_lock_service.dart` + `security_provider.dart` + `storage_service.dart`
- Live logs: `log_stream_service.dart` + `logs_provider.dart` + `connection_banner.dart`

## Live stream status (do not conflate signals)

Three **independent** signals — never tie "offline" to WebSocket alone:

| Signal | Meaning | Set by |
|--------|---------|--------|
| `isLive` | WebSocket handshake succeeded (`channel.ready`) | `LogStreamService` |
| `isDeviceOffline` | No network (`ConnectivityResult.none`) | `LogsNotifier` |
| `isShowingCachedLogs` | REST failed or device offline; list may be stale | `LogsNotifier` |

### Banner copy (realistic UX)

```
isLive                          → "Live stream connected" (green)
!isLive && cached/offline       → "Offline — showing cached logs" (amber)
!isLive && online && REST OK    → "Reconnecting to live stream…" (amber)
```

### WebSocket rules

- Endpoint: `wss://…/v1/stream?projectId=&token=` (WSAuth, same as web dashboard)
- **Never** use `/mobile/stream` from Flutter — it requires `Authorization` header
- Emit `isLive: true` only after `await channel.ready` — not on `connect()` call
- On disconnect: emit `false` immediately; backoff reconnect (1→16 s)
- Debounce connectivity-driven `loadLogs()` (~800 ms) to avoid status flicker
- Do **not** set `isShowingCachedLogs` when WebSocket drops but REST still works

### Anti-patterns

- ❌ `isOfflineData: !live && logs.isNotEmpty` on every WS event
- ❌ Showing "Live" before socket handshake completes
- ❌ Calling `loadLogs()` on every connectivity blip without debounce
- ❌ Treating cached logs as "offline" when only the stream is reconnecting

## Session security lifecycle

### Device prefs (survive logout)

- `onboarding_complete`
- `app_lock_mode` (`immediate` | `never`)
- Notification tone

### Session data (cleared on logout)

- Access/refresh tokens, user profile, selected project
- App PIN hash (secure storage)
- Biometric unlock flag
- Log cache (Hive)

Use `StorageService.clearSession()` — **not** `prefs.clear()` bare — on sign-out.

### Post-logout → re-login flow

1. `logout()` → `clearSession()` + `clearPin()` + `setBiometricEnabled(false)`
2. `securityProvider.refresh()` → `needsSetup = lockMode==immediate && !hasPin`
3. Router: authenticated + `needsSetup` → `/onboarding/security` (skip splash/push)
4. `SecuritySetupScreen`: if already signed in, title "Set up your PIN" → `context.go('/')`
5. `markConfigured()` after PIN saved — do not re-run first-run onboarding

### Lock mode semantics

- `immediate` + no PIN → **must** complete security setup before shell
- `never` → skip PIN; go straight to shell after login

## Onboarding (first install only)

splash → push permission (must grant) → security setup → login → shell

Push step: `NotificationService.requestPermission()`. Decline → stay on push screen with retry + Settings hint.

## Audit checklist (verify before shipping)

### Navigation
- [ ] Settings shows back affordance on iOS (`leading: BackButton` when on `/settings`)
- [ ] Post-logout login routes to security when lock mode is immediate
- [ ] Onboarding cannot skip push if product requires alerts

### Security
- [ ] PIN hash cleared on logout (`clearSession` deletes `_appPinHashKey`)
- [ ] Biometrics disabled on logout
- [ ] App PIN stored as SHA-256 hash, never plaintext
- [ ] `NSFaceIDUsageDescription` in `ios/Runner/Info.plist`

### Connection banner
- [ ] No rapid Live ↔ Offline flicker when stream reconnects
- [ ] "Reconnecting…" shown when REST works but WS is down
- [ ] "Offline — cached" only when device offline or REST failed

### Loading states
- [ ] `LogstackLoading` / `LogListSkeleton` on empty lists
- [ ] `LogsNotifier` guards `state =` after async with `_disposed`

## File map

| Concern | Files |
|---------|-------|
| Stream status | `services/log_stream_service.dart`, `providers/logs_provider.dart`, `widgets/connection_banner.dart` |
| Session security | `providers/security_provider.dart`, `services/storage_service.dart`, `providers/auth_provider.dart` |
| Onboarding | `screens/onboarding/splash_screen.dart`, `push_permission_screen.dart`, `security_setup_screen.dart` |
| Router gates | `router.dart` |
| Config | `config/app_config.dart` |

## Store build (iOS)

```bash
cd apps/mobile
./scripts/run_ios.sh -d "iPhone 16 Pro"   # simulator — not plain flutter run
./scripts/run_device.sh                    # physical device
```

## Design tokens

Match `lib/theme/logstack_colors.dart` — dark zinc surfaces, Inter + JetBrains Mono.