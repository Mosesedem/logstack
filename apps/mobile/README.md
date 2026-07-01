# Logstack Mobile

Flutter app for real-time log monitoring, alerts, and project management.

## Setup

```bash
cd apps/mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs
```

App launcher icons live in `assets/icons/` (Android, iOS, and web variants). After updating those assets, sync them to platform projects:

```bash
# Android
cp -R assets/icons/android/res/* android/app/src/main/res/

# iOS
cp assets/icons/ios/*.png ios/Runner/Assets.xcassets/AppIcon.appiconset/
cp assets/icons/ios/Contents.json ios/Runner/Assets.xcassets/AppIcon.appiconset/Contents.json

# Web
cp assets/icons/web/icon-192.png web/icons/Icon-192.png
cp assets/icons/web/icon-512.png web/icons/Icon-512.png
cp assets/icons/web/icon-192-maskable.png web/icons/Icon-maskable-192.png
cp assets/icons/web/icon-512-maskable.png web/icons/Icon-maskable-512.png
cp assets/icons/web/favicon.ico web/favicon.ico
cp assets/icons/web/apple-touch-icon.png web/apple-touch-icon.png
```

## Run

```bash
flutter run
```