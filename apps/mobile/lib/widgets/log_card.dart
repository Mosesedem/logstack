import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:logstack_mobile/models/log.dart';
import 'package:logstack_mobile/theme/app_theme.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
import 'package:logstack_mobile/widgets/level_badge.dart';

class LogCard extends StatelessWidget {
  const LogCard({super.key, required this.log, this.onTap});

  final Log log;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final mono = context.logMono;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: LogstackColors.surface,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: LogstackColors.borderSubtle),
            ),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    width: 4,
                    decoration: BoxDecoration(
                      color: LogstackColors.levelForeground(log.level),
                      borderRadius: const BorderRadius.horizontal(
                        left: Radius.circular(10),
                      ),
                    ),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              LevelBadge(level: log.level),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  log.message,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: mono.bodyMedium?.copyWith(
                                    height: 1.35,
                                    color: LogstackColors.textPrimary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Text(
                                _formatTime(log.createdAt),
                                style: mono.labelSmall?.copyWith(
                                  color: LogstackColors.textMuted,
                                ),
                              ),
                              if (log.source != null) ...[
                                const SizedBox(width: 12),
                                Text(
                                  log.source!,
                                  style: mono.labelSmall?.copyWith(
                                    color: LogstackColors.textSecondary,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _formatTime(DateTime dateTime) {
    final difference = DateTime.now().difference(dateTime);
    if (difference.inMinutes < 1) return 'Just now';
    if (difference.inHours < 1) return '${difference.inMinutes}m ago';
    if (difference.inDays < 1) return '${difference.inHours}h ago';
    return DateFormat('MMM d, HH:mm').format(dateTime);
  }
}