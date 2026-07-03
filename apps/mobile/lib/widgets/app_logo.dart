import 'package:flutter/material.dart';
import 'package:logstack_mobile/constants/app_assets.dart';

/// Brand mark for onboarding, auth, and lock screens.
///
/// Uses the white rounded app-icon asset directly — no extra slate frame.
/// The launch/splash screen looked correct because the icon fills the tile;
/// wrapping it in [LogstackColors.surface] on other screens shrank the mark
/// and added an awkward second background.
class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.size = 88});

  final double size;

  @override
  Widget build(BuildContext context) {
    final radius = size * 0.22;
    return SizedBox(
      width: size,
      height: size,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Image.asset(
          AppAssets.logo,
          width: size,
          height: size,
          fit: BoxFit.cover,
          filterQuality: FilterQuality.high,
        ),
      ),
    );
  }
}