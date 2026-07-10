/// Bundled brand image paths (registered in `pubspec.yaml`).
///
/// Monorepo source of truth: repo-root `assets/` → generated into
/// `apps/mobile/assets/icons/` by `./scripts/sync_brand_icons.sh`.
/// In-app marks use the web solid/clear tiles so Flutter matches PWA branding.
class AppAssets {
  AppAssets._();

  /// Primary brand tile. Matches home-screen / store icon.
  /// Prefer for splash, auth, lock.
  static const logo = 'assets/icons/web/icon-512.png';

  /// Transparent white mark only. Use on colored / non-black surfaces.
  static const logoClear = 'assets/icons/web/icon-clear-512.png';

  /// Full-resolution master tile (RGB). Prefer [logo] in widgets unless you
  /// need maximum fidelity (e.g. marketing / share previews).
  static const logoMaster = 'assets/icons/master-1024.png';

  /// Full-resolution transparent mark (RGBA).
  static const logoMasterClear = 'assets/icons/master-clear-1024.png';
}
