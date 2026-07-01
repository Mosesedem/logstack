import 'package:flutter/material.dart';
import 'package:logstack_mobile/constants/app_assets.dart';

class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.size = 64});

  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.22),
      child: Image.asset(
        AppAssets.logo,
        width: size,
        height: size,
        fit: BoxFit.cover,
      ),
    );
  }
}