#!/usr/bin/env bash
# Build and run on iOS simulator, working around Xcode 16.x DerivedData bugs.
#
# Plain `flutter run` or Xcode "Build" can fail with:
#   - WriteAuxiliaryFile ... all-product-headers.yaml
#   - disk I/O error on .../XCBuildData/build.db
# when DerivedData is corrupt or disk space is low. Always use this script for sim runs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOCK_DIR="$ROOT/ios/.simulator-build.lock.d"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another simulator build is already running (lock: $LOCK_DIR)."
  echo "Wait for it to finish, or run: rm -rf $LOCK_DIR"
  exit 1
fi
trap 'rm -rf "$LOCK_DIR"' EXIT

AVAIL_KB="$(df -k / | awk 'NR==2 {print $4}')"
MIN_KB=$((8 * 1024 * 1024)) # 8 GiB
if [[ "$AVAIL_KB" -lt "$MIN_KB" ]]; then
  AVAIL_GB=$((AVAIL_KB / 1024 / 1024))
  echo "Warning: only ${AVAIL_GB} GiB free on /. Xcode needs ~10+ GiB."
  echo "Free space (empty Trash, ~/Library/Developer/Xcode/DerivedData) before building."
fi

# Aggressively clean global Xcode DerivedData/ModuleCache.
# This is the source of the "Unable to rename ... .pcm.tmp" / "Could not build Objective-C module 'Darwin'" errors
# when using plain `flutter run` on some machines (especially with low disk space).
rm -rf "$HOME/Library/Developer/Xcode/DerivedData/ModuleCache.noindex"
rm -rf "$HOME/Library/Developer/Xcode/DerivedData"/Runner-*

STAT_CACHE_DIR="$HOME/Library/Developer/Xcode/DerivedData/SDKStatCaches.noindex"
STAT_CACHE_FILE="$STAT_CACHE_DIR/iphonesimulator18.2-22C146-07b28473f605e47e75261259d3ef3b5a.sdkstatcache"
SDK_ROOT="/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator18.2.sdk"
CLANG_STAT_CACHE="/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang-stat-cache"

mkdir -p "$STAT_CACHE_DIR"
if [[ -x "$CLANG_STAT_CACHE" && -d "$SDK_ROOT" ]]; then
  "$CLANG_STAT_CACHE" "$SDK_ROOT" -o "$STAT_CACHE_FILE"
fi

flutter pub get
(cd ios && pod install)

# Wipe local build artifacts (corrupt build.db causes disk I/O errors mid-compile).
rm -rf build/ios
find ios/DerivedData -mindepth 1 -delete 2>/dev/null || rm -rf ios/DerivedData 2>/dev/null || true
mkdir -p ios/DerivedData

if ! xcodebuild \
  -workspace ios/Runner.xcworkspace \
  -scheme Runner \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  -derivedDataPath ios/DerivedData \
  -jobs 1 \
  build; then
  echo ""
  echo "Simulator build failed. Common fixes:"
  echo "  1. Free 10+ GiB disk space (check: df -h /)"
  echo "  2. Re-run: ./scripts/run_ios.sh"
  echo "  3. Do not run xcodebuild / Xcode Build in parallel with this script"
  exit 1
fi

APP_BINARY="ios/DerivedData/Build/Products/Debug-iphonesimulator/Runner.app"
flutter run --use-application-binary="$APP_BINARY" "$@"