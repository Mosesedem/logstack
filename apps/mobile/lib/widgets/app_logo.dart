import 'package:flutter/material.dart';
import 'package:logstack_mobile/constants/app_assets.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';

class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.size = 64});

  final double size;

  @override
  Widget build(BuildContext context) {
    final radius = size * 0.22;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: LogstackColors.surface,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: LogstackColors.borderSubtle),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Padding(
          padding: EdgeInsets.all(size * 0.12),
          child: Image.asset(
            AppAssets.logo,
            fit: BoxFit.contain,
            filterQuality: FilterQuality.high,
          ),
        ),
      ),
    );
  }
}