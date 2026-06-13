import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/alert.dart';
import 'package:logstack_mobile/models/log.dart';
import 'package:logstack_mobile/providers/alerts_provider.dart';
import 'package:logstack_mobile/providers/project_provider.dart';
import 'package:logstack_mobile/widgets/level_badge.dart';
import 'package:intl/intl.dart';

class AlertsScreen extends ConsumerStatefulWidget {
  const AlertsScreen({super.key});

  @override
  ConsumerState<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends ConsumerState<AlertsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final alertsState = ref.watch(alertsProvider);
    final projectState = ref.watch(projectProvider);

    if (projectState.currentProject == null) {
      return const Center(
        child: Text('Select a project to view alerts'),
      );
    }

    return Column(
      children: [
        TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Rules'),
            Tab(text: 'History'),
          ],
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _RulesTab(
                rules: alertsState.rules,
                isLoading: alertsState.isLoading,
              ),
              _HistoryTab(
                history: alertsState.history,
                isLoading: alertsState.isLoading,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _RulesTab extends ConsumerWidget {
  final List<AlertRule> rules;
  final bool isLoading;

  const _RulesTab({required this.rules, required this.isLoading});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (isLoading && rules.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (rules.isEmpty) {
      return const Center(child: Text('No alert rules configured'));
    }

    return RefreshIndicator(
      onRefresh: () => ref.read(alertsProvider.notifier).loadAlerts(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: rules.length,
        itemBuilder: (context, index) {
          final rule = rules[index];
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              title: Text(rule.name),
              subtitle: Row(
                children: [
                  LevelBadge(level: rule.level),
                  const SizedBox(width: 8),
                  Text('${rule.threshold}/${rule.window}s'),
                ],
              ),
              trailing: Switch(
                value: rule.enabled,
                onChanged: (enabled) {
                  ref.read(alertsProvider.notifier).toggleAlert(
                        rule.id,
                        enabled,
                      );
                },
              ),
            ),
          );
        },
      ),
    );
  }
}

class _HistoryTab extends ConsumerWidget {
  final List<AlertHistory> history;
  final bool isLoading;

  const _HistoryTab({required this.history, required this.isLoading});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (isLoading && history.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (history.isEmpty) {
      return const Center(child: Text('No alerts triggered yet'));
    }

    return RefreshIndicator(
      onRefresh: () => ref.read(alertsProvider.notifier).loadAlerts(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: history.length,
        itemBuilder: (context, index) {
          final item = history[index];
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              leading: Icon(
                Icons.notifications,
                color: _getColorForLevel(item.level),
              ),
              title: Text(item.ruleName),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.message),
                  const SizedBox(height: 4),
                  Text(
                    DateFormat('MMM d, yyyy HH:mm').format(item.triggeredAt),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
              isThreeLine: true,
            ),
          );
        },
      ),
    );
  }

  Color _getColorForLevel(LogLevel level) {
    switch (level) {
      case LogLevel.info:
        return Colors.blue;
      case LogLevel.warn:
        return Colors.orange;
      case LogLevel.error:
        return Colors.red;
      case LogLevel.critical:
        return Colors.red.shade900;
    }
  }
}
