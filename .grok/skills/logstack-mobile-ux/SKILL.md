---
name: logstack-mobile-ux
description: >
  End-to-end guide for Logstack Flutter mobile companion app UX: onboarding splash,
  push permission gate, app security (PIN, biometrics, lock modes), project picker,
  settings navigation, loading states, and store builds. Use when working on
  apps/mobile design polish, iOS back navigation, splash/onboarding, app lock,
  or when the user runs /logstack-mobile-ux.
---

# Logstack Mobile UX

Companion app only — PIN/QR/email link, view logs, escalate, settings. No account creation on device.

## Architecture

- Entry: `lib/main.dart` → `LogstackApp` → `AppLockGate` → `MaterialApp.router`
- Router: `lib/router.dart` — auth routes, onboarding routes, `ShellRoute` with `HomeScreen`
- Security: `lib/services/app_lock_service.dart` + `storage_service.dart` (PIN hash, lock mode, biometrics)
- Onboarding: splash → push permission (must grant) → security setup (PIN + optional biometrics) → main shell

## Audit checklist (verify before shipping)

### Navigation
- [ ] Settings shows back affordance on iOS (`leading: BackButton` when on `/settings`)
- [ ] Log detail has back via system gesture / `context.pop()`
- [ ] Onboarding cannot skip push if product requires alerts (decline → stay on push screen)

### Security
- [ ] Lock modes: `immediate` (lock on resume) vs `never`
- [ ] App PIN stored as SHA-256 hash in secure storage, never plaintext
- [ ] Biometric toggle prompts `LocalAuthentication` before enabling
- [ ] Unlock screen offers biometrics when enabled, PIN fallback always available
- [ ] `NSFaceIDUsageDescription` present in `ios/Runner/Info.plist`

### Project picker
- [ ] Bottom sheet with search field, not raw `DropdownButton`
- [ ] Shows current project name + env badge; filters client-side
- [ ] Loading shimmer while `projectProvider.isLoading`

### Loading states
- [ ] Use `LogstackLoading` / `LogListSkeleton` — no bare `CircularProgressIndicator` on empty lists
- [ ] Pull-to-refresh retains list with inline indicator

### Logo
- [ ] `AppLogo` uses square marketing asset with `BoxFit.contain` inside rounded container
- [ ] Asset path: `assets/icons/web/icon-512.png` (not play_store strip artifact)

### Push notifications
- [ ] `NotificationService.initialize()` does NOT auto-request permission — onboarding calls `requestPermission()`
- [ ] After auth, FCM token registers via `authProvider`

### Known bugs to guard
- [ ] `LogsNotifier._startForProject` checks `mounted` before `state =` after async gaps
- [ ] WebSocket URL: `app_config.dart` must not produce `:0` port in wss URLs

## File map

| Concern | Files |
|---------|-------|
| Onboarding | `screens/onboarding/splash_screen.dart`, `push_permission_screen.dart`, `security_setup_screen.dart` |
| Security | `services/app_lock_service.dart`, `widgets/app_lock_gate.dart`, `widgets/pin_pad.dart` |
| Picker | `widgets/project_picker.dart` |
| Loading | `widgets/loading_states.dart` |
| Settings | `screens/settings/settings_screen.dart` |
| Router | `router.dart` — onboarding redirect before auth shell |

## Onboarding redirect logic

```dart
if (!onboardingComplete && !isOnboardingRoute) return '/splash';
if (onboardingComplete && isOnboardingRoute) return '/';
```

Push step: call `NotificationService.instance.requestPermission()`. If not `authorized`/`provisional`, show rationale + retry + open Settings — do not advance.

Security step: require 4–6 digit PIN confirmation; offer biometric enable if `LocalAuthentication` available.

## Store build (iOS)

```bash
cd apps/mobile
flutter pub get
(cd ios && pod install)
# Simulator workaround (dev):
./scripts/run_ios.sh -d "iPhone 16 Pro"
# Release archive:
flutter build ipa --release
# Or Xcode: Product → Archive with Runner scheme, automatic signing
```

Bump `version` in `pubspec.yaml` (`name+build`) before each store upload.

## Design tokens

Match `lib/theme/logstack_colors.dart` and `app_theme.dart` — dark zinc surfaces, Inter + JetBrains Mono, 10px radius cards.