import 'package:flutter/material.dart';
import 'package:logstack_mobile/models/log.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';

/// Horizontal severity chips — standard observability pattern (Datadog/Sentry-style).
class LogLevelFilterBar extends StatelessWidget {
  const LogLevelFilterBar({
    super.key,
    required this.selected,
    required this.onSelected,
  });

  final LogLevel? selected;
  final ValueChanged<LogLevel?> onSelected;

  static const _options = <(String, LogLevel?)>[
    ('All', null),
    ('Debug', LogLevel.debug),
    ('Info', LogLevel.info),
    ('Warn', LogLevel.warn),
    ('Error', LogLevel.error),
    ('Critical', LogLevel.critical),
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _options.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final (label, level) = _options[index];
          final isSelected = selected == level;
          final color = level == null
              ? LogstackColors.textSecondary
              : LogstackColors.levelForeground(level);

          return FilterChip(
            label: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (level != null) ...[
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                ],
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                    color: isSelected
                        ? LogstackColors.textPrimary
                        : LogstackColors.textSecondary,
                  ),
                ),
              ],
            ),
            selected: isSelected,
            showCheckmark: false,
            padding: const EdgeInsets.symmetric(horizontal: 4),
            labelPadding: const EdgeInsets.symmetric(horizontal: 8),
            backgroundColor: LogstackColors.surface,
            selectedColor: LogstackColors.surfaceElevated,
            side: BorderSide(
              color: isSelected ? color.withValues(alpha: 0.5) : LogstackColors.border,
            ),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            onSelected: (_) => onSelected(level),
          );
        },
      ),
    );
  }
}