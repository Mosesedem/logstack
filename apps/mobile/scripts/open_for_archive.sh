#!/usr/bin/env bash
# Fix Xcode caches, use project-local DerivedData, open workspace for Archive.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/fix_xcode_cache.sh"
open "$ROOT/ios/Runner.xcworkspace"