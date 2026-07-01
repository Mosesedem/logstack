import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:logstack_mobile/providers/project_provider.dart';
import 'package:logstack_mobile/screens/logs/logs_screen.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';

class HomeScreen extends ConsumerWidget {
  final Widget child;

  const HomeScreen({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projectState = ref.watch(projectProvider);
    final currentIndex = _calculateSelectedIndex(context);
    final location = GoRouterState.of(context).uri.path;
    final isLogsTab = location == '/' || location.startsWith('/logs');

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
        actions: isLogsTab ? LogsScreenActions.buildActions(context, ref) : null,
      ),
      body: child,
      bottomNavigationBar: NavigationBar(
        backgroundColor: LogstackColors.surface,
        selectedIndex: currentIndex,
        onDestinationSelected: (index) => _onItemTapped(index, context),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.article_outlined),
            selectedIcon: Icon(Icons.article),
            label: 'Logs',
          ),
          NavigationDestination(
            icon: Icon(Icons.notifications_outlined),
            selectedIcon: Icon(Icons.notifications),
            label: 'Alerts',
          ),
          NavigationDestination(
            icon: Icon(Icons.folder_outlined),
            selectedIcon: Icon(Icons.folder),
            label: 'Projects',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }

  int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).uri.path;
    if (location.startsWith('/alerts')) return 1;
    if (location.startsWith('/projects')) return 2;
    if (location.startsWith('/settings')) return 3;
    return 0;
  }

  void _onItemTapped(int index, BuildContext context) {
    switch (index) {
      case 0:
        context.go('/');
        break;
      case 1:
        context.go('/alerts');
        break;
      case 2:
        context.go('/projects');
        break;
      case 3:
        context.go('/settings');
        break;
    }
  }
}
