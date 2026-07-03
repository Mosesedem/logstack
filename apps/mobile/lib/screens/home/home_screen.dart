import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:logstack_mobile/providers/auth_provider.dart';
import 'package:logstack_mobile/providers/project_provider.dart';
import 'package:logstack_mobile/screens/logs/logs_screen.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
/// Shell: logs viewer + minimal settings. No dashboard-style tabs.
class HomeScreen extends ConsumerWidget {
  final Widget child;

  const HomeScreen({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projectState = ref.watch(projectProvider);
    final authState = ref.watch(authProvider);
    final location = GoRouterState.of(context).uri.path;
    final isLogsTab = location == '/' || location.startsWith('/logs');
    final isSettings = location.startsWith('/settings');

    return Scaffold(
      appBar: AppBar(
        title: projectState.currentProject != null
            ? DropdownButton<String>(
                value: projectState.currentProject!.id,
                underline: const SizedBox(),
                items: projectState.projects.map((project) {
                  return DropdownMenuItem(
                    value: project.id,
                    child: Text(project.name),
                  );
                }).toList(),
                onChanged: (id) {
                  final project =
                      projectState.projects.firstWhere((p) => p.id == id);
                  ref.read(projectProvider.notifier).setCurrentProject(project);
                },
              )
            : const Text('Logstack'),
        actions: [
          if (isLogsTab) ...LogsScreenActions.buildActions(context, ref),
          IconButton(
            icon: Icon(
              Icons.settings_outlined,
              color: isSettings
                  ? Theme.of(context).colorScheme.primary
                  : null,
            ),
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
                'No connection — your account stays signed in. Logs will sync when you\'re back online.',
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