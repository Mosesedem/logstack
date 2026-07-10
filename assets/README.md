# Logstack brand assets

**Source of truth** for product icons across web, mobile, and docs.

## Files

| File | Use |
|------|-----|
| `icon.png` | Primary solid brand tile (1024, squircle) |
| `icon_clear.png` | Transparent white mark |
| `icon.svg` | Vector mark (favicons / docs) |
| `favicon.ico` / `favicon-16x16.png` / `favicon-32x32.png` | Browser tabs |
| `apple-touch-icon.png` | iOS home-screen (web) |
| `android-chrome-192x192.png` / `android-chrome-512x512.png` | PWA |
| `composed logo-iOS-*` | Optional iOS marketing / store variants |
| `site.webmanifest` | Synced from web dark-theme manifest |

## Propagate to the monorepo

After replacing any file here:

```bash
# from repo root
./scripts/sync_brand_icons.sh
```

That updates:

1. `apps/web/public/*` — Next.js dashboard, landing, docs, PWA
2. `apps/mobile/assets/icons/*` — Flutter masters + Android/iOS/Web tiles
3. Native mobile launchers / splash / notification monochrome
4. `docs/logo.svg` — README / docs mark

Do **not** edit copies under `apps/web/public` or `apps/mobile/assets/icons` by hand.
