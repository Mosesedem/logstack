import 'package:flutter/material.dart';
import 'package:logstack_mobile/models/subscription.dart';

class UsageCard extends StatelessWidget {
  final UsageSummary usage;
  final VoidCallback? onUpgradePressed;

  const UsageCard({
    super.key,
    required this.usage,
    this.onUpgradePressed,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    Color progressColor;
    if (usage.isOverLimit) {
      progressColor = colorScheme.error;
    } else if (usage.usagePercentage >= 80) {
      progressColor = Colors.orange;
    } else {
      progressColor = Colors.green;
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Usage This Month',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: _getTierColor(usage.tier).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _getTierName(usage.tier),
                    style: TextStyle(
                      color: _getTierColor(usage.tier),
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${usage.formattedLogCount} / ${usage.formattedLogLimit} logs',
                  style: theme.textTheme.bodyMedium,
                ),
                Text(
                  usage.logLimit < 0
                      ? 'Unlimited'
                      : '${usage.usagePercentage.toStringAsFixed(1)}%',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: progressColor,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: usage.logLimit < 0
                    ? 0
                    : (usage.usagePercentage / 100).clamp(0.0, 1.0),
                minHeight: 8,
                backgroundColor: colorScheme.surfaceContainerHighest,
                valueColor: AlwaysStoppedAnimation<Color>(progressColor),
              ),
            ),
            if (usage.isOverLimit) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: colorScheme.errorContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.warning,
                      color: colorScheme.error,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'You\'ve exceeded your limit. Upgrade to continue logging.',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: colorScheme.onErrorContainer,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ] else if (usage.usagePercentage >= 80) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.orange.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.info_outline,
                      color: Colors.orange,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'You\'re approaching your limit. Consider upgrading.',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: Colors.orange[900],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (usage.tier != SubscriptionTier.enterprise &&
                onUpgradePressed != null) ...[
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: onUpgradePressed,
                  child: const Text('Upgrade Plan'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _getTierName(SubscriptionTier tier) {
    switch (tier) {
      case SubscriptionTier.free:
        return 'FREE';
      case SubscriptionTier.starter:
        return 'STARTER';
      case SubscriptionTier.pro:
        return 'PRO';
      case SubscriptionTier.enterprise:
        return 'ENTERPRISE';
    }
  }

  Color _getTierColor(SubscriptionTier tier) {
    switch (tier) {
      case SubscriptionTier.free:
        return Colors.grey;
      case SubscriptionTier.starter:
        return Colors.blue;
      case SubscriptionTier.pro:
        return Colors.purple;
      case SubscriptionTier.enterprise:
        return Colors.orange;
    }
  }
}
