#!/usr/bin/env bash
# Build, install, and launch on a physical iPhone.
#
# Usage:
#   ./scripts/run_device.sh
#   SKIP_BUILD=1 ./scripts/run_device.sh          # reinstall existing build
#   ./scripts/run_device.sh --dart-define=LOGSTACK_API_URL=http://192.168.1.x:8080/v1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEVICE_ID="${DEVICE_ID:-00008030-000A785E0290802E}"
DEVICE_NAME="${DEVICE_NAME:-Moses iPhone}"
DERIVED_DATA="$ROOT/ios/DerivedData"
APP_BINARY="$ROOT/build/ios/Debug-iphoneos/Runner.app"
SKIP_BUILD="${SKIP_BUILD:-0}"

echo "Target: $DEVICE_NAME ($DEVICE_ID)"
echo ""
echo "On your iPhone:"
echo "  - Unlocked and on USB"
echo "  - Trust This Computer if prompted"
echo "  - Settings > Privacy & Security > Developer Mode ON"
echo ""

# Do NOT rm -rf ModuleCache.noindex (breaks Session.modulevalidation mid-build).
mkdir -p "$HOME/Library/Developer/Xcode/DerivedData/ModuleCache.noindex"
touch "$HOME/Library/Developer/Xcode/DerivedData/ModuleCache.noindex/Session.modulevalidation" 2>/dev/null || true

STAT_CACHE_DIR="$HOME/Library/Developer/Xcode/DerivedData/SDKStatCaches.noindex"
SDK_ROOT="/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS18.2.sdk"
CLANG_STAT_CACHE="/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang-stat-cache"
# Xcode 16.2 expected device stat-cache name (hash is SDK-specific, not shasum of path).
STAT_CACHE_FILE="$STAT_CACHE_DIR/iphoneos18.2-22C146-d5b9239ec3bf5b3adbecdf21472871e3.sdkstatcache"

mkdir -p "$STAT_CACHE_DIR"
if [[ -x "$CLANG_STAT_CACHE" && -d "$SDK_ROOT" ]]; then
  "$CLANG_STAT_CACHE" "$SDK_ROOT" -o "$STAT_CACHE_FILE" 2>/dev/null || true
fi

if [[ "$SKIP_BUILD" != "1" ]]; then
  flutter pub get
  (cd ios && pod install)

  find "$DERIVED_DATA" -mindepth 1 -delete 2>/dev/null || true
  mkdir -p "$DERIVED_DATA"

  defaults write com.apple.dt.Xcode IDECustomDerivedDataLocation -string "$DERIVED_DATA"
  cleanup() {
    defaults delete com.apple.dt.Xcode IDECustomDerivedDataLocation 2>/dev/null || true
  }
  trap cleanup EXIT

  echo "Building (first run may take several minutes)..."
  flutter build ios --debug "$@"

  if [[ ! -f "$APP_BINARY/Runner" ]]; then
    echo "Build did not produce $APP_BINARY"
    echo "Try: open ios/Runner.xcworkspace → Runner → Signing & Capabilities → select Team"
    exit 1
  fi
elif [[ ! -f "$APP_BINARY/Runner" ]]; then
  echo "No build at $APP_BINARY — run without SKIP_BUILD=1 first."
  exit 1
else
  echo "Skipping build (SKIP_BUILD=1), using existing binary."
fi

echo "Installing on $DEVICE_NAME..."
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_BINARY"

echo "Launching Logstack..."
if xcrun devicectl device process launch --device "$DEVICE_ID" tech.logstack.mobile 2>&1; then
  echo ""
  echo "Done — Logstack is running on your iPhone."
else
  echo ""
  echo "Installed successfully. Unlock your iPhone and open Logstack from the home screen."
fi
echo "Hot reload: flutter attach -d $DEVICE_ID"