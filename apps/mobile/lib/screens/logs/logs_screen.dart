import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:logstack_mobile/providers/logs_provider.dart';
import 'package:logstack_mobile/services/log_stream_service.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
import 'package:logstack_mobile/widgets/connection_banner.dart';
import 'package:logstack_mobile/widgets/empty_state.dart';
import 'package:logstack_mobile/widgets/loading_states.dart';
import 'package:logstack_mobile/widgets/log_card.dart';
import 'package:logstack_mobile/widgets/log_level_filter_bar.dart';

class LogsScreen extends ConsumerStatefulWidget {
  const LogsScreen({super.key});

  @override
  ConsumerState<LogsScreen> createState() => _LogsScreenState();
}

class _LogsScreenState extends ConsumerState<LogsScreen> {
  final _searchController = TextEditingController();
  Timer? _searchDebounce;

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 400), () {
      ref.read(logsProvider.notifier).setSearchQuery(
            query.trim().isEmpty ? null : query.trim(),
          );
    });
  }

  @override
  Widget build(BuildContext context) {
    final logsState = ref.watch(logsProvider);

    return Column(
      children: [
        ConnectionBanner(
          isLive: logsState.isLive,
          isShowingCachedLogs: logsState.isShowingCachedLogs,
          isDeviceOffline: logsState.isDeviceOffline,
          isStreamUnavailable: logsState.isStreamUnavailable,
          onRetryStream: () => ref.read(logStreamServiceProvider).retry(),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: TextField(
            controller: _searchController,
            decoration: const InputDecoration(
              hintText: 'Search logs…',
              prefixIcon: Icon(Icons.search, size: 20),
            ),
            onChanged: _onSearchChanged,
            onSubmitted: (q) => ref.read(logsProvider.notifier).setSearchQuery(
                  q.trim().isEmpty ? null : q.trim(),
                ),
          ),
        ),
        const SizedBox(height: 10),
        LogLevelFilterBar(
          selected: logsState.levelFilter,
          onSelected: (level) =>
              ref.read(logsProvider.notifier).setLevelFilter(level),
        ),
        const SizedBox(height: 8),
        Expanded(child: _buildBody(logsState)),
      ],
    );
  }

  Widget _buildBody(LogsState logsState) {
    if (logsState.isLoading && logsState.logs.isEmpty) {
      return const LogListSkeleton();
    }

    if (logsState.error != null && logsState.logs.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => ref.read(logsProvider.notifier).refresh(),
        color: LogstackColors.accentBlue,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: MediaQuery.of(context).size.height * 0.6,
              child: EmptyState(
                icon: Icons.error_outline,
                title: 'Could not load logs',
                subtitle: logsState.error,
                action: FilledButton(
                  onPressed: () => ref.read(logsProvider.notifier).loadLogs(),
                  child: const Text('Retry'),
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (logsState.logs.isEmpty) {
      final searching = logsState.searchQuery?.isNotEmpty == true;
      return RefreshIndicator(
        onRefresh: () => ref.read(logsProvider.notifier).refresh(),
        color: LogstackColors.accentBlue,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: MediaQuery.of(context).size.height * 0.6,
              child: EmptyState(
                icon: searching ? Icons.search_off : Icons.terminal,
                title: searching ? 'No matching logs' : 'No logs yet',
                subtitle: searching
                    ? 'Try a different search or clear filters.'
                    : 'Send logs from your SDK or wait for the live stream.',
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => ref.read(logsProvider.notifier).refresh(),
      color: LogstackColors.accentBlue,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: logsState.logs.length + (logsState.hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == logsState.logs.length) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Center(
                child: logsState.isLoading
                    ? const CircularProgressIndicator()
                    : TextButton(
                        onPressed: () => ref.read(logsProvider.notifier).loadMore(),
                        child: const Text('Load more'),
                      ),
              ),
            );
          }
          final log = logsState.logs[index];
          return LogCard(
            log: log,
            onTap: () => context.push('/logs/${log.id}', extra: log),
          );
        },
      ),
    );
  }
}

class LogsScreenActions {
  static List<Widget> buildActions(BuildContext context, WidgetRef ref) {
    return [
      IconButton(
        icon: const Icon(Icons.refresh),
        tooltip: 'Refresh logs',
        onPressed: () => ref.read(logsProvider.notifier).refresh(),
      ),
    ];
  }
}