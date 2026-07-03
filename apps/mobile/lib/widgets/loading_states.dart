import 'package:flutter/material.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
import 'package:shimmer/shimmer.dart';

class LogstackLoading extends StatelessWidget {
  const LogstackLoading({super.key, this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: LogstackColors.accentBlue,
            ),
          ),
          if (message != null) ...[
            const SizedBox(height: 16),
            Text(
              message!,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: LogstackColors.textSecondary,
                  ),
            ),
          ],
        ],
      ),
    );
  }
}

class LogListSkeleton extends StatelessWidget {
  const LogListSkeleton({super.key, this.itemCount = 6});

  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: LogstackColors.surface,
      highlightColor: LogstackColors.surfaceElevated,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: itemCount,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, __) => Container(
          height: 88,
          decoration: BoxDecoration(
            color: LogstackColors.surface,
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ),
    );
  }
}

class ProjectPickerSkeleton extends StatelessWidget {
  const ProjectPickerSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: LogstackColors.surface,
      highlightColor: LogstackColors.surfaceElevated,
      child: Container(
        width: 140,
        height: 24,
        decoration: BoxDecoration(
          color: LogstackColors.surface,
          borderRadius: BorderRadius.circular(6),
        ),
      ),
    );
  }
}