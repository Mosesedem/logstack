import 'package:flutter/material.dart';
import 'package:logstack_mobile/models/log.dart';

class LevelBadge extends StatelessWidget {
  final LogLevel level;

  const LevelBadge({super.key, required this.level});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _getBackgroundColor(),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        level.name.toUpperCase(),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: _getTextColor(),
        ),
      ),
    );
  }

  Color _getBackgroundColor() {
    switch (level) {
      case LogLevel.info:
        return Colors.blue.withValues(alpha: 0.2);
      case LogLevel.warn:
        return Colors.orange.withValues(alpha: 0.2);
      case LogLevel.error:
        return Colors.red.withValues(alpha: 0.2);
      case LogLevel.critical:
        return Colors.red.shade900.withValues(alpha: 0.2);
    }
  }

  Color _getTextColor() {
    switch (level) {
      case LogLevel.info:
        return Colors.blue;
      case LogLevel.warn:
        return Colors.orange;
      case LogLevel.error:
        return Colors.red;
      case LogLevel.critical:
        return Colors.red.shade900;
    }
  }
}
