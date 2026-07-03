import 'package:flutter/material.dart';
import 'package:logstack_mobile/models/log.dart';

/// Design tokens extracted from `apps/web/src/app/globals.css` (dark) and
/// `apps/web/src/components/logs/level-badge.tsx`.
abstract final class LogstackColors {
  // Surfaces — dashboard dark + landing mobile mockup (#09090b)
  static const background = Color(0xFF09090B);
  static const surface = Color(0xFF18181B);
  static const surfaceElevated = Color(0xFF27272A);
  static const border = Color(0xFF3F3F46);
  static const borderSubtle = Color(0x1AFFFFFF);

  // Text
  static const textPrimary = Color(0xFFFAFAFA);
  static const textSecondary = Color(0xFFA1A1AA);
  static const textMuted = Color(0xFF71717A);

  // Brand accent (web primary / CTA)
  static const accent = Color(0xFFFAFAFA);
  static const accentBlue = Color(0xFF3B82F6);

  // Severity palette (Tailwind levels from web LevelBadge)
  static const debugPurple = Color(0xFFC084FC);
  static const debugPurpleBg = Color(0x33C084FC);
  static const infoBlue = Color(0xFF3B82F6);
  static const infoBlueBg = Color(0x333B82F6);
  static const warnAmber = Color(0xFFEAB308);
  static const warnAmberBg = Color(0x33EAB308);
  static const errorRed = Color(0xFFEF4444);
  static const errorRedBg = Color(0x33EF4444);
  static const criticalRed = Color(0xFFB91C1C);
  static const criticalRedBg = Color(0x33B91C1C);

  // Terminal chrome (landing page window dots)
  static const terminalRed = Color(0xFFFF5F56);
  static const terminalYellow = Color(0xFFFFBD2E);
  static const terminalGreen = Color(0xFF27C93F);

  // Status
  static const liveGreen = Color(0xFF22C55E);
  static const offlineGray = Color(0xFF71717A);

  static Color levelForeground(LogLevel level) {
    switch (level) {
      case LogLevel.debug:
        return debugPurple;
      case LogLevel.info:
        return infoBlue;
      case LogLevel.warn:
        return warnAmber;
      case LogLevel.error:
        return errorRed;
      case LogLevel.critical:
      case LogLevel.fatal:
        return criticalRed;
    }
  }

  static Color levelBackground(LogLevel level) {
    switch (level) {
      case LogLevel.debug:
        return debugPurpleBg;
      case LogLevel.info:
        return infoBlueBg;
      case LogLevel.warn:
        return warnAmberBg;
      case LogLevel.error:
        return errorRedBg;
      case LogLevel.critical:
      case LogLevel.fatal:
        return criticalRedBg;
    }
  }
}