import 'package:flutter/material.dart';
import 'package:logstack_mobile/models/log.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';

class LevelBadge extends StatelessWidget {
  const LevelBadge({super.key, required this.level});

  final LogLevel level;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: LogstackColors.levelBackground(level),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        level.name.toUpperCase(),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
          color: LogstackColors.levelForeground(level),
        ),
      ),
    );
  }
}