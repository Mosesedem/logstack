#!/usr/bin/env bash
# Repair Xcode 16.x ModuleCache / UIKit .pcm failures before Archive.
set -euo pipefail

echo "Quitting Xcode (if open)…"
osascript -e 'tell application "Xcode" to quit' 2>/dev/null || true
sleep 2

FREE_GB=$(df -g "$HOME" | awk 'NR==2 {print $4}')
if [[ "$FREE_GB" -lt 15 ]]; then
  echo "WARNING: Only ${FREE_GB}GB free. Low disk space causes .pcm rename failures."
  echo "Empty Trash and delete old DerivedData before archiving."
fi

DERIVED="$HOME/Library/Developer/Xcode/DerivedData"
MODULE_CACHE="$DERIVED/ModuleCache.noindex"
STAT_CACHE_DIR="$DERIVED/SDKStatCaches.noindex"
SDK_ROOT="/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS18.2.sdk"
CLANG_STAT_CACHE="/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang-stat-cache"

echo "Resetting ModuleCache…"
rm -rf "$MODULE_CACHE"
mkdir -p "$MODULE_CACHE"
touch "$MODULE_CACHE/Session.modulevalidation"

echo "Clearing stale DerivedData (keeping SDKStatCaches)…"
find "$DERIVED" -mindepth 1 -maxdepth 1 ! -name 'SDKStatCaches.noindex' -exec rm -rf {} + 2>/dev/null || true
mkdir -p "$MODULE_CACHE"
touch "$MODULE_CACHE/Session.modulevalidation"

echo "Warming SDK stat cache…"
mkdir -p "$STAT_CACHE_DIR"
if [[ -x "$CLANG_STAT_CACHE" && -d "$SDK_ROOT" ]]; then
  "$CLANG_STAT_CACHE" "$SDK_ROOT" \
    -o "$STAT_CACHE_DIR/iphoneos18.2-22C146-d5b9239ec3bf5b3adbecdf21472871e3.sdkstatcache" \
    2>/dev/null || true
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_DERIVED="$ROOT/ios/DerivedData"
rm -rf "$PROJECT_DERIVED"
mkdir -p "$PROJECT_DERIVED"

# Route Xcode GUI archives through project-local DerivedData (avoids Runner-* global cache bugs).
defaults write com.apple.dt.Xcode IDECustomDerivedDataLocation -string "$PROJECT_DERIVED"
# Serial compiles reduce ModuleCache .pcm rename races on Xcode 16.x.
defaults write com.apple.dt.Xcode IDEBuildOperationMaxNumberOfConcurrentCompileTasks -int 1

echo ""
echo "Done. ModuleCache:"
ls -la "$MODULE_CACHE"
echo "Xcode DerivedData → $PROJECT_DERIVED"
echo ""
echo "Next:"
echo "  1. open $ROOT/ios/Runner.xcworkspace"
echo "  2. Select Any iOS Device (arm64)"
echo "  3. Product → Clean Build Folder (⇧⌘K)"
echo "  4. Product → Archive"
echo ""
echo "To restore default DerivedData later:"
echo "  defaults delete com.apple.dt.Xcode IDECustomDerivedDataLocation"