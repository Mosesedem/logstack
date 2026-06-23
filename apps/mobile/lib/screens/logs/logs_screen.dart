import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/log.dart';
import 'package:logstack_mobile/providers/logs_provider.dart';
import 'package:logstack_mobile/widgets/log_card.dart';

class LogsScreen extends ConsumerWidget {
  const LogsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logsState = ref.watch(logsProvider);
    final logs = logsState.logs;
    final isLoading = logsState.isLoading;
    final error = logsState.error;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Logs'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.read(logsProvider.notifier).loadLogs(),
          ),
          PopupMenuButton<LogLevel?>(
            icon: const Icon(Icons.filter_list),
            onSelected: (level) {
              ref.read(logsProvider.notifier).setLevelFilter(level);
            },
            itemBuilder: (context) => [
              const PopupMenuItem<LogLevel?>(value: null, child: Text('All levels')),
              const PopupMenuItem(value: LogLevel.info, child: Text('Info')),
              const PopupMenuItem(value: LogLevel.warn, child: Text('Warn')),
              const PopupMenuItem(value: LogLevel.error, child: Text('Error')),
              const PopupMenuItem(value: LogLevel.critical, child: Text('Critical')),
              // Note: 'fatal' may be sent by SDKs but enum is info/warn/error/critical in current models
            ],
          ),
        ],
      ),
      body: isLoading && logs.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Error: $error'),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () => ref.read(logsProvider.notifier).loadLogs(),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : logs.isEmpty
                  ? const Center(child: Text('No logs yet. Send some logs from your app!'))
                  : RefreshIndicator(
                      onRefresh: () => ref.read(logsProvider.notifier).loadLogs(),
                      child: ListView.builder(
                        itemCount: logs.length,
                        itemBuilder: (context, index) {
                          final log = logs[index];
                          return LogCard(
                            log: log,
                            onTap: () {
                              // go_router will navigate via the ShellRoute definition in router.dart
                            },
                          );
                        },
                      ),
                    ),
    );
  }
}
