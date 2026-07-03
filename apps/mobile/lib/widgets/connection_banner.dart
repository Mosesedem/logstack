import 'package:flutter/material.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';

class ConnectionBanner extends StatelessWidget {
  const ConnectionBanner({
    super.key,
    required this.isLive,
    required this.isShowingCachedLogs,
    this.isDeviceOffline = false,
  });

  final bool isLive;
  final bool isShowingCachedLogs;
  final bool isDeviceOffline;

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

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: LogstackColors.warnAmber.withValues(alpha: 0.12),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_outlined, size: 16, color: LogstackColors.warnAmber),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              isShowingCachedLogs || isDeviceOffline
                  ? 'Offline — showing cached logs'
                  : 'Reconnecting to live stream…',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: LogstackColors.warnAmber,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}