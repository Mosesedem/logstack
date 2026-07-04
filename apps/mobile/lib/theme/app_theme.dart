import 'package:flutter/material.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';

abstract final class AppTheme {
  static const _sansFamily = 'Inter';
  static const _monoFamily = 'JetBrainsMono';

  static ThemeData get dark {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: LogstackColors.background,
      colorScheme: const ColorScheme.dark(
        surface: LogstackColors.surface,
        onSurface: LogstackColors.textPrimary,
        onSurfaceVariant: LogstackColors.textSecondary,
        primary: LogstackColors.accent,
        onPrimary: LogstackColors.background,
        secondary: LogstackColors.surfaceElevated,
        outline: LogstackColors.border,
        error: LogstackColors.errorRed,
      ),
    );

    final sans = base.textTheme.apply(
      fontFamily: _sansFamily,
      bodyColor: LogstackColors.textPrimary,
      displayColor: LogstackColors.textPrimary,
    );
    final mono = sans.apply(fontFamily: _monoFamily);

    return base.copyWith(
      textTheme: sans,
      primaryTextTheme: sans,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: LogstackColors.background,
        foregroundColor: LogstackColors.textPrimary,
        titleTextStyle: sans.titleLarge?.copyWith(fontWeight: FontWeight.w600),
      ),
      cardTheme: CardThemeData(
        color: LogstackColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: LogstackColors.borderSubtle),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: LogstackColors.borderSubtle,
        thickness: 1,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: LogstackColors.surface,
        indicatorColor: LogstackColors.surfaceElevated,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontFamily: _sansFamily,
            fontSize: 12,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? LogstackColors.textPrimary : LogstackColors.textMuted,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? LogstackColors.textPrimary : LogstackColors.textMuted,
          );
        }),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: LogstackColors.surface,
        hintStyle: const TextStyle(
          fontFamily: _sansFamily,
          color: LogstackColors.textMuted,
        ),
        labelStyle: const TextStyle(
          fontFamily: _sansFamily,
          color: LogstackColors.textSecondary,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: LogstackColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: LogstackColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: LogstackColors.accentBlue, width: 1.5),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: LogstackColors.textPrimary,
          foregroundColor: LogstackColors.background,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: sans.labelLarge?.copyWith(fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: LogstackColors.textPrimary,
          side: const BorderSide(color: LogstackColors.border),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: LogstackColors.textSecondary),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: LogstackColors.textPrimary,
        unselectedLabelColor: LogstackColors.textMuted,
        indicatorColor: LogstackColors.accentBlue,
        dividerColor: LogstackColors.borderSubtle,
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: LogstackColors.surfaceElevated,
        contentTextStyle: TextStyle(
          fontFamily: _sansFamily,
          color: LogstackColors.textPrimary,
        ),
      ),
      extensions: [LogstackTextStyles(mono: mono)],
    );
  }
}

class LogstackTextStyles extends ThemeExtension<LogstackTextStyles> {
  const LogstackTextStyles({required this.mono});

  final TextTheme mono;

  @override
  LogstackTextStyles copyWith({TextTheme? mono}) =>
      LogstackTextStyles(mono: mono ?? this.mono);

  @override
  LogstackTextStyles lerp(ThemeExtension<LogstackTextStyles>? other, double t) =>
      this;
}

extension LogstackThemeContext on BuildContext {
  TextTheme get logMono =>
      Theme.of(this).extension<LogstackTextStyles>()?.mono ??
      Theme.of(this).textTheme;
}