#!/usr/bin/env bash
# Build release IPA, working around Xcode 16.x DerivedData/ModuleCache bugs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Pre-flight: low disk space causes ModuleCache .pcm rename failures.
FREE_GB=$(df -g "$HOME" | awk 'NR==2 {print $4}')
if [[ "$FREE_GB" -lt 20 ]]; then
  echo "WARNING: Only ${FREE_GB}GB free on $HOME. Xcode needs ~20GB+ for reliable archives."
  echo "Free space (empty Trash, DerivedData) before continuing."
fi

# Ensure ModuleCache exists — do NOT rm -rf it (breaks Session.modulevalidation).
mkdir -p "$HOME/Library/Developer/Xcode/DerivedData/ModuleCache.noindex"
touch "$HOME/Library/Developer/Xcode/DerivedData/ModuleCache.noindex/Session.modulevalidation"

# Warm SDK stat cache for device builds.
STAT_CACHE_DIR="$HOME/Library/Developer/Xcode/DerivedData/SDKStatCaches.noindex"
SDK_ROOT="/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS18.2.sdk"
CLANG_STAT_CACHE="/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang-stat-cache"
mkdir -p "$STAT_CACHE_DIR"
if [[ -x "$CLANG_STAT_CACHE" && -d "$SDK_ROOT" ]]; then
  STAT_FILE="$STAT_CACHE_DIR/iphoneos18.2-22C146-$(echo -n "$SDK_ROOT" | shasum -a 256 | cut -c1-32).sdkstatcache"
  "$CLANG_STAT_CACHE" "$SDK_ROOT" -o "$STAT_FILE" 2>/dev/null || true
fi

# Optional: override with DEVELOPMENT_TEAM=XXXXXXXXXX ./scripts/build_ipa.sh
# Personal: 9LZKVD339M | Company: K8T663XUUD
TEAM_ID="${DEVELOPMENT_TEAM:-9LZKVD339M}"

# Preflight: archive needs an Apple ID in Xcode (automatic signing + App Store export).
if ! defaults read com.apple.dt.Xcode DVTDeveloperAccountManagerAppleIDLists IDE.Identifiers.Prod 2>/dev/null | grep -q .; then
  echo "ERROR: No Apple Developer account in Xcode."
  echo ""
  echo "Before building for TestFlight:"
  echo "  1. Open Xcode → Settings (⌘,) → Accounts"
  echo "  2. Add your Apple ID (must be on the App Store Connect team)"
  echo "  3. Select the team → Download Manual Profiles (or let automatic signing run once)"
  echo "  4. In developer.apple.com, ensure bundle ID tech.logstack.mobile exists with Push Notifications enabled"
  echo ""
  echo "Then re-run: ./scripts/build_ipa.sh"
  exit 1
fi

echo "Using development team: $TEAM_ID"
echo "Building with isolated DerivedData at ios/DerivedData…"

flutter pub get
(cd ios && pod install)

rm -rf ios/DerivedData
mkdir -p ios/DerivedData

xcodebuild \
  -workspace ios/Runner.xcworkspace \
  -scheme Runner \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath ios/DerivedData \
  -archivePath ios/DerivedData/Runner.xcarchive \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  -jobs 1 \
  archive

xcodebuild \
  -exportArchive \
  -archivePath ios/DerivedData/Runner.xcarchive \
  -exportPath ios/DerivedData/ipa \
  -exportOptionsPlist ios/ExportOptions.plist \
  -allowProvisioningUpdates

echo ""
echo "✓ IPA ready: ios/DerivedData/ipa/*.ipa"
ls -la ios/DerivedData/ipa/