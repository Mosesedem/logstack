#!/usr/bin/env bash
# Build and run on iOS simulator, working around Xcode 16.x DerivedData bugs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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

rm -rf ios/DerivedData
xcodebuild \
  -workspace ios/Runner.xcworkspace \
  -scheme Runner \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  -derivedDataPath ios/DerivedData \
  -jobs 1 \
  build

APP_BINARY="ios/DerivedData/Build/Products/Debug-iphonesimulator/Runner.app"
flutter run --use-application-binary="$APP_BINARY" "$@"