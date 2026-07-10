import 'package:flutter/material.dart';
import 'package:logstack_mobile/constants/app_assets.dart';

/// Brand mark for onboarding, auth, lock, and loading screens.
///
/// Always prefer [AppLogo] over ad-hoc [Image.asset] so the Logstack mark from
/// `assets/icons/` stays consistent across the app.
///
/// - Default: solid app-icon tile (`icon-512`) with iOS-style corner radius.
/// - [clear]: transparent white mark (`icon-clear-512`) for non-black surfaces.
class AppLogo extends StatelessWidget {
  const AppLogo({
    super.key,
    this.size = 88,
    this.clear = false,
  });

  final double size;

  /// When true, uses the transparent mark (`icon-clear`).
  final bool clear;

  @override
  Widget build(BuildContext context) {
    final radius = size * 0.22;
    final asset = clear ? AppAssets.logoClear : AppAssets.logo;

    final image = Image.asset(
      asset,
      width: size,
      height: size,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      gaplessPlayback: true,
      semanticLabel: 'Logstack',
    );

    if (clear) {
      // Transparent mark — no clip (shape is the brand).
      return SizedBox(width: size, height: size, child: image);
    }

    // Solid tile matches the store / home-screen icon silhouette.
    return SizedBox(
      width: size,
      height: size,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: image,
      ),
    );
  }
}
