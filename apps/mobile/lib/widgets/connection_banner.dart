import 'package:flutter/material.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';

class ConnectionBanner extends StatelessWidget {
  const ConnectionBanner({
    super.key,
    required this.isLive,
    required this.isShowingCachedLogs,
    this.isDeviceOffline = false,
    this.isStreamUnavailable = false,
    this.onRetryStream,
  });

  final bool isLive;
  final bool isShowingCachedLogs;
  final bool isDeviceOffline;
  final bool isStreamUnavailable;
  final VoidCallback? onRetryStream;

  @override
  Widget build(BuildContext context) {
    if (isLive) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        color: LogstackColors.liveGreen.withValues(alpha: 0.12),
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: LogstackColors.liveGreen,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'Live stream connected',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: LogstackColors.liveGreen,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
      );
    }

    if (isShowingCachedLogs || isDeviceOffline) {
      return _banner(
        context,
        icon: Icons.cloud_off_outlined,
        color: LogstackColors.warnAmber,
        text: 'Offline — showing cached logs',
      );
    }

    if (isStreamUnavailable) {
      return _banner(
        context,
        icon: Icons.sync_problem_outlined,
        color: LogstackColors.textMuted,
        text: 'Live stream unavailable — pull to refresh logs',
        action: onRetryStream == null
            ? null
            : TextButton(
                onPressed: onRetryStream,
                child: const Text('Retry'),
              ),
      );
    }

    return _banner(
      context,
      icon: Icons.sync,
      color: LogstackColors.warnAmber,
      text: 'Reconnecting to live stream…',
    );
  }

  Widget _banner(
    BuildContext context, {
    required IconData icon,
    required Color color,
    required String text,
    Widget? action,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: color.withValues(alpha: 0.12),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          if (action != null) action,
        ],
      ),
    );
  }
}
