#!/usr/bin/env bash
# Sync Logstack brand icons monorepo-wide.
#
# Source of truth: repo-root assets/
# Propagates to:
#   - apps/web/public          (dashboard, landing, docs, PWA)
#   - apps/mobile/assets/icons (masters + web tiles)
#   - apps/mobile platform packs via apps/mobile/scripts/sync_icons.sh
#   - docs/logo.svg            (README / docs)
#
# Usage (from repo root):
#   ./scripts/sync_brand_icons.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/assets"
WEB_PUBLIC="$ROOT/apps/web/public"
MOBILE_ICONS="$ROOT/apps/mobile/assets/icons"
DOCS="$ROOT/docs"

die() { echo "error: $*" >&2; exit 1; }
need() { [[ -e "$1" ]] || die "missing $1 — drop brand pack into assets/"; }

need "$SRC/icon.png"
need "$SRC/icon_clear.png"
need "$SRC/icon.svg"
need "$SRC/favicon.ico"
need "$SRC/apple-touch-icon.png"
need "$SRC/android-chrome-192x192.png"
need "$SRC/android-chrome-512x512.png"
need "$SRC/favicon-16x16.png"
need "$SRC/favicon-32x32.png"

echo "═══ 1/4  Web public (apps/web/public) ═══"
mkdir -p "$WEB_PUBLIC"
cp "$SRC/icon.png" "$WEB_PUBLIC/icon.png"
cp "$SRC/icon_clear.png" "$WEB_PUBLIC/icon_clear.png"
cp "$SRC/icon.svg" "$WEB_PUBLIC/icon.svg"
cp "$SRC/favicon.ico" "$WEB_PUBLIC/favicon.ico"
cp "$SRC/favicon-16x16.png" "$WEB_PUBLIC/favicon-16x16.png"
cp "$SRC/favicon-32x32.png" "$WEB_PUBLIC/favicon-32x32.png"
cp "$SRC/apple-touch-icon.png" "$WEB_PUBLIC/apple-touch-icon.png"
cp "$SRC/android-chrome-192x192.png" "$WEB_PUBLIC/android-chrome-192x192.png"
cp "$SRC/android-chrome-512x512.png" "$WEB_PUBLIC/android-chrome-512x512.png"

# Keep Logstack dark-theme manifest (root RealFavicon often ships empty names).
cat > "$WEB_PUBLIC/site.webmanifest" <<'EOF'
{
  "name": "Logstack",
  "short_name": "Logstack",
  "description": "Real-time log monitoring and alerts",
  "icons": [
    {
      "src": "/android-chrome-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/android-chrome-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/android-chrome-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "theme_color": "#09090b",
  "background_color": "#09090b",
  "display": "standalone",
  "start_url": "/"
}
EOF

# Align root manifest with web for convenience.
cp "$WEB_PUBLIC/site.webmanifest" "$SRC/site.webmanifest"

echo "═══ 2/4  Docs logo ═══"
mkdir -p "$DOCS"
cp "$SRC/icon.svg" "$DOCS/logo.svg"

echo "═══ 3/4  Mobile masters + web tiles ═══"
python3 "$ROOT/scripts/generate_mobile_icons.py"

echo "═══ 4/4  Mobile platform launchers / splash ═══"
"$ROOT/apps/mobile/scripts/sync_icons.sh"

echo
echo "✓ Brand icons synced monorepo-wide from assets/"
echo "  web:    apps/web/public"
echo "  mobile: apps/mobile/assets/icons + Android/iOS/Web/macOS"
echo "  docs:   docs/logo.svg"
