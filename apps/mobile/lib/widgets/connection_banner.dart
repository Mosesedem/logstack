import 'package:flutter/material.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';

/// Stream/network status chip.
///
/// Only two user-facing states:
/// - Live when the WebSocket is delivering frames
/// - Offline when device/network is down and we're on cache
///
/// Stream reconnect / failure is silent — REST logs still work without noise.
class ConnectionBanner extends StatelessWidget {
  const ConnectionBanner({
    super.key,
    required this.isLive,
    required this.isShowingCachedLogs,
    this.isDeviceOffline = false,
    // Kept for call-site compatibility; no longer rendered.
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
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        color: LogstackColors.warnAmber.withValues(alpha: 0.12),
        child: Row(
          children: [
            Icon(
              Icons.cloud_off_outlined,
              size: 16,
              color: LogstackColors.warnAmber,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Offline — showing cached logs',
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

    // Stream down / reconnecting: no banner (avoid noise when REST is fine).
    return const SizedBox.shrink();
  }
}
