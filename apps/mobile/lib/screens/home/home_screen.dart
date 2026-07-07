import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:logstack_mobile/providers/auth_provider.dart';
import 'package:logstack_mobile/screens/logs/logs_screen.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
import 'package:logstack_mobile/widgets/project_picker.dart';

/// Shell: logs viewer + minimal settings. No dashboard-style tabs.
class HomeScreen extends ConsumerWidget {
  final Widget child;

  const HomeScreen({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final location = GoRouterState.of(context).uri.path;
    final isLogDetail = location.startsWith('/logs/');
    final isLogsTab = location == '/' || isLogDetail;
    final isSettings = location.startsWith('/settings');
    final showBack = isSettings || isLogDetail;

    return Scaffold(
      appBar: AppBar(
        leading: showBack
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                tooltip: 'Back',
                onPressed: () => context.go('/'),
              )
            : null,
        automaticallyImplyLeading: showBack,
        title: isSettings
            ? const Text('Settings')
            : isLogDetail
                ? const Text('Log detail')
                : const ProjectPicker(),
        actions: [
          if (isLogsTab) ...LogsScreenActions.buildActions(context, ref),
          if (!isSettings)
            IconButton(
              icon: const Icon(Icons.settings_outlined),
              tooltip: 'Settings',
              onPressed: () => context.go('/settings'),
            ),
        ],
      ),
      body: Column(
        children: [
          if (authState.isOfflineAuth)
            MaterialBanner(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              backgroundColor: LogstackColors.warnAmber.withValues(alpha: 0.12),
              leading: const Icon(
                Icons.cloud_off_outlined,
                color: LogstackColors.warnAmber,
              ),
              content: const Text(
                'No connection. Your Logs will sync when you\'re back online.',
              ),
              actions: [
                TextButton(
                  onPressed: () =>
                      ref.read(authProvider.notifier).refreshSession(),
                  child: const Text('Retry'),
                ),
              ],
            ),
          Expanded(child: child),
        ],
      ),
    );
  }
}
