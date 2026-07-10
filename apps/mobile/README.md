# Logstack Mobile

Flutter companion app for real-time log monitoring, alerts, and project management.

## Setup

```bash
cd apps/mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs
```

## Brand icons

**Monorepo source of truth:** repo-root `assets/` (not this folder alone).

After updating brand files under `/assets`, from the **repo root**:

```bash
./scripts/sync_brand_icons.sh
```

That regenerates:

| Target | Content |
|--------|---------|
| `assets/icons/master-*.png` | Flutter masters |
| `assets/icons/web/*` | In-app `AppLogo` + mobile web PWA |
| `assets/icons/android/**` | Adaptive launcher + monochrome |
| `assets/icons/ios/**` | AppIcon set |
| Android / iOS / Web / macOS platforms | Launchers, splash, notification icons |

Local-only re-sync (after masters already exist):

```bash
./scripts/sync_icons.sh
```

In Flutter UI always use `AppLogo` / `AppAssets` — never hardcode other image paths.

## Run

```bash
flutter run
```

### iOS simulator (Xcode 16.x cache issues)

If `flutter run` fails with `sdkstatcache not found` or `ModuleCache` errors,
use the helper script (builds with project-local DerivedData):

```bash
./scripts/run_ios.sh -d "iPhone 16 Pro"
```

Plain `flutter run` may still fail on some Macs due to a corrupted global Xcode
DerivedData cache. Android and physical iOS devices are unaffected.
