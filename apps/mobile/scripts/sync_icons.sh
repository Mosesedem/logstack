#!/usr/bin/env bash
# Sync assets/icons → Android, iOS, Web, macOS launchers + native splash marks.
# Source of truth: apps/mobile/assets/icons/
#
# Usage (from apps/mobile):
#   ./scripts/sync_icons.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ICONS="$ROOT/assets/icons"
ANDROID_RES="$ROOT/android/app/src/main/res"
IOS_APPICON="$ROOT/ios/Runner/Assets.xcassets/AppIcon.appiconset"
IOS_LAUNCH="$ROOT/ios/Runner/Assets.xcassets/LaunchImage.imageset"
WEB="$ROOT/web"
MACOS_APPICON="$ROOT/macos/Runner/Assets.xcassets/AppIcon.appiconset"

die() { echo "error: $*" >&2; exit 1; }

need() { [[ -e "$1" ]] || die "missing $1"; }

need "$ICONS/android/res"
need "$ICONS/ios"
need "$ICONS/web"
need "$ICONS/master-1024.png"
need "$ICONS/web/icon-clear-512.png"

echo "→ Android mipmaps + adaptive icon XML"
mkdir -p "$ANDROID_RES"
for dens in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  src="$ICONS/android/res/mipmap-$dens"
  dest="$ANDROID_RES/mipmap-$dens"
  if [[ -d "$src" ]]; then
    mkdir -p "$dest"
    cp "$src/"*.png "$dest/"
  fi
done
if [[ -d "$ICONS/android/res/mipmap-anydpi-v26" ]]; then
  mkdir -p "$ANDROID_RES/mipmap-anydpi-v26"
  cp "$ICONS/android/res/mipmap-anydpi-v26/"* "$ANDROID_RES/mipmap-anydpi-v26/"
fi

echo "→ Android notification monochrome (drawable-*)"
for dens in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  src="$ICONS/android/res/mipmap-$dens/ic_launcher_monochrome.png"
  dest_dir="$ANDROID_RES/drawable-$dens"
  if [[ -f "$src" ]]; then
    mkdir -p "$dest_dir"
    cp "$src" "$dest_dir/ic_launcher_monochrome.png"
  fi
done

echo "→ Android splash launch_logo (drawable-*)"
# White mark on transparent — centered on #09090B launch_background.
CLEAR="$ICONS/web/icon-clear-512.png"
# Logical ~96dp mark across densities.
for pair in mdpi:96 hdpi:144 xhdpi:192 xxhdpi:288 xxxhdpi:384; do
  dens="${pair%%:*}"
  size="${pair##*:}"
  dest_dir="$ANDROID_RES/drawable-$dens"
  mkdir -p "$dest_dir"
  sips -z "$size" "$size" "$CLEAR" --out "$dest_dir/launch_logo.png" >/dev/null
done

echo "→ iOS AppIcon"
mkdir -p "$IOS_APPICON"
cp "$ICONS/ios/"*.png "$IOS_APPICON/"
cp "$ICONS/ios/Contents.json" "$IOS_APPICON/Contents.json"

echo "→ iOS LaunchImage (centered brand mark)"
mkdir -p "$IOS_LAUNCH"
sips -z 200 200 "$CLEAR" --out "$IOS_LAUNCH/LaunchImage.png" >/dev/null
sips -z 400 400 "$CLEAR" --out "$IOS_LAUNCH/LaunchImage@2x.png" >/dev/null
sips -z 600 600 "$CLEAR" --out "$IOS_LAUNCH/LaunchImage@3x.png" >/dev/null

echo "→ Web PWA / favicon"
mkdir -p "$WEB/icons"
cp "$ICONS/web/icon-192.png" "$WEB/icons/Icon-192.png"
cp "$ICONS/web/icon-512.png" "$WEB/icons/Icon-512.png"
cp "$ICONS/web/icon-192-maskable.png" "$WEB/icons/Icon-maskable-192.png"
cp "$ICONS/web/icon-512-maskable.png" "$WEB/icons/Icon-maskable-512.png"
cp "$ICONS/web/favicon.ico" "$WEB/favicon.ico"
cp "$ICONS/web/apple-touch-icon.png" "$WEB/apple-touch-icon.png"

echo "→ macOS AppIcon (from master-1024)"
mkdir -p "$MACOS_APPICON"
MASTER="$ICONS/master-1024.png"
for size in 16 32 64 128 256 512 1024; do
  sips -z "$size" "$size" "$MASTER" --out "$MACOS_APPICON/app_icon_${size}.png" >/dev/null
done

echo "✓ Icons synced from assets/icons → Android, iOS, Web, macOS (+ splash marks)"
