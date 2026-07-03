#!/usr/bin/env bash
# Run Logstack on a physical iPhone (uses flutter run for signing + deploy).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEVICE_ID="${DEVICE_ID:-00008030-000A785E0290802E}"
DEVICE_NAME="${DEVICE_NAME:-Moses iPhone}"

echo "Target: $DEVICE_NAME ($DEVICE_ID)"
echo ""
echo "On your iPhone, ensure:"
echo "  • Unlocked and connected via USB"
echo "  • Tap Trust This Computer if prompted"
echo "  • Settings → Privacy & Security → Developer Mode → ON (reboot if asked)"
echo ""

# Avoid ClangStatCache / ModuleCache failures (do not delete ModuleCache.noindex).
mkdir -p "$HOME/Library/Developer/Xcode/DerivedData/ModuleCache.noindex"
touch "$HOME/Library/Developer/Xcode/DerivedData/ModuleCache.noindex/Session.modulevalidation" 2>/dev/null || true

STAT_CACHE_DIR="$HOME/Library/Developer/Xcode/DerivedData/SDKStatCaches.noindex"
SDK_ROOT="/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS18.2.sdk"
CLANG_STAT_CACHE="/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang-stat-cache"
mkdir -p "$STAT_CACHE_DIR"
if [[ -x "$CLANG_STAT_CACHE" && -d "$SDK_ROOT" ]]; then
  STAT_FILE="$STAT_CACHE_DIR/iphoneos18.2-22C146-$(echo -n "$SDK_ROOT" | shasum -a 256 | cut -c1-32).sdkstatcache"
  echo "Warming SDK stat cache…"
  "$CLANG_STAT_CACHE" "$SDK_ROOT" -o "$STAT_FILE" || true
fi

flutter pub get
(cd ios && pod install)

export CLANG_STAT_CACHE_ENABLE=NO
export SDK_STAT_CACHE_ENABLE=NO

echo "Building and launching (first device build may take several minutes)…"
flutter run -d "$DEVICE_ID" --device-timeout 180 "$@"