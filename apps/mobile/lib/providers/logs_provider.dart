import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/log.dart';
import 'package:logstack_mobile/services/log_cache_service.dart';
import 'package:logstack_mobile/services/log_service.dart';
import 'package:logstack_mobile/services/log_stream_service.dart';
import 'package:logstack_mobile/providers/project_provider.dart';

final logsProvider = StateNotifierProvider<LogsNotifier, LogsState>((ref) {
  final notifier = LogsNotifier(
    logService: ref.watch(logServiceProvider),
    cacheService: ref.watch(logCacheServiceProvider),
    streamService: ref.watch(logStreamServiceProvider),
    projectId: ref.watch(projectProvider).currentProject?.id,
  );
  ref.listen(projectProvider, (prev, next) {
    notifier.onProjectChanged(next.currentProject?.id);
  });
  ref.onDispose(notifier.cleanup);
  return notifier;
});

class LogsState {
  final List<Log> logs;
  final bool isLoading;
  final bool hasMore;
  final int offset;
  final String? error;
  final LogLevel? levelFilter;
  final String? searchQuery;
  final bool isLive;
  final bool isOfflineData;

  const LogsState({
    this.logs = const [],
    this.isLoading = false,
    this.hasMore = true,
    this.offset = 0,
    this.error,
    this.levelFilter,
    this.searchQuery,
    this.isLive = false,
    this.isOfflineData = false,
  });

  LogsState copyWith({
    List<Log>? logs,
    bool? isLoading,
    bool? hasMore,
    int? offset,
    String? error,
    LogLevel? levelFilter,
    String? searchQuery,
    bool? isLive,
    bool? isOfflineData,
    bool clearError = false,
  }) {
    return LogsState(
      logs: logs ?? this.logs,
      isLoading: isLoading ?? this.isLoading,
      hasMore: hasMore ?? this.hasMore,
      offset: offset ?? this.offset,
      error: clearError ? null : (error ?? this.error),
      levelFilter: levelFilter ?? this.levelFilter,
      searchQuery: searchQuery ?? this.searchQuery,
      isLive: isLive ?? this.isLive,
      isOfflineData: isOfflineData ?? this.isOfflineData,
    );
  }
}

class LogsNotifier extends StateNotifier<LogsState> {
  LogsNotifier({
    required LogService logService,
    required LogCacheService cacheService,
    required LogStreamService streamService,
    String? projectId,
  })  : _logService = logService,
        _cacheService = cacheService,
        _streamService = streamService,
        _projectId = projectId,
        super(const LogsState()) {
    _init();
  }

  final LogService _logService;
  final LogCacheService _cacheService;
  final LogStreamService _streamService;
  String? _projectId;

  StreamSubscription<Log>? _logSub;
  StreamSubscription<bool>? _connSub;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;

  Future<void> _init() async {
    _logSub = _streamService.logStream.listen(_onRealtimeLog);
    _connSub = _streamService.connectionStream.listen((live) {
      state = state.copyWith(isLive: live, isOfflineData: !live && state.logs.isNotEmpty);
    });
    _connectivitySub = Connectivity().onConnectivityChanged.listen((_) {
      loadLogs();
    });
    if (_projectId != null) {
      await _startForProject(_projectId!);
    }
  }

  void onProjectChanged(String? projectId) {
    if (_projectId == projectId) return;
    _projectId = projectId;
    if (projectId == null) {
      _streamService.disconnect();
      state = const LogsState();
      return;
    }
    _startForProject(projectId);
  }

  Future<void> _startForProject(String projectId) async {
    final cached = await _cacheService.getLogs(projectId);
    final filtered = _cacheService.filterLocal(
      logs: cached,
      level: state.levelFilter,
      search: state.searchQuery,
    );
    state = LogsState(
      logs: filtered,
      levelFilter: state.levelFilter,
      searchQuery: state.searchQuery,
      isOfflineData: filtered.isNotEmpty,
    );
    await _streamService.connect(projectId);
    await loadLogs();
  }

  Future<void> loadLogs() async {
    if (_projectId == null) return;

    final connectivity = await Connectivity().checkConnectivity();
    final online = !connectivity.contains(ConnectivityResult.none);

    if (!online) {
      final cached = await _cacheService.getLogs(_projectId!);
      state = state.copyWith(
        logs: _cacheService.filterLocal(
          logs: cached,
          level: state.levelFilter,
          search: state.searchQuery,
        ),
        isLoading: false,
        isOfflineData: true,
        isLive: false,
        clearError: true,
      );
      return;
    }

    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await _logService.getLogs(
        projectId: _projectId!,
        level: state.levelFilter,
        search: state.searchQuery,
        offset: 0,
      );
      await _cacheService.saveLogs(_projectId!, response.logs);
      state = LogsState(
        logs: response.logs,
        hasMore: response.hasMore,
        offset: response.offset,
        levelFilter: state.levelFilter,
        searchQuery: state.searchQuery,
        isLive: state.isLive,
        isOfflineData: false,
      );
    } catch (e) {
      final cached = await _cacheService.getLogs(_projectId!);
      state = state.copyWith(
        isLoading: false,
        error: e.toString().replaceAll('Exception: ', ''),
        logs: _cacheService.filterLocal(
          logs: cached,
          level: state.levelFilter,
          search: state.searchQuery,
        ),
        isOfflineData: cached.isNotEmpty,
      );
    }
  }

  Future<void> loadMore() async {
    if (_projectId == null || !state.hasMore || state.isLoading || state.isOfflineData) {
      return;
    }

    state = state.copyWith(isLoading: true);
    try {
      final response = await _logService.getLogs(
        projectId: _projectId!,
        level: state.levelFilter,
        search: state.searchQuery,
        offset: state.offset + 50,
      );
      final merged = [...state.logs, ...response.logs];
      await _cacheService.saveLogs(_projectId!, merged);
      state = state.copyWith(
        logs: merged,
        hasMore: response.hasMore,
        offset: response.offset,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void setLevelFilter(LogLevel? level) {
    state = state.copyWith(levelFilter: level);
    loadLogs();
  }

  void setSearchQuery(String? query) {
    state = state.copyWith(searchQuery: query);
    loadLogs();
  }

  void _onRealtimeLog(Log log) {
    if (_projectId == null || log.projectId != _projectId) return;
    if (state.levelFilter != null && log.level != state.levelFilter) return;
    if (state.searchQuery != null &&
        state.searchQuery!.isNotEmpty &&
        !log.message.toLowerCase().contains(state.searchQuery!.toLowerCase())) {
      return;
    }
    final exists = state.logs.any((l) => l.id == log.id);
    if (exists) return;
    final updated = [log, ...state.logs].take(200).toList();
    state = state.copyWith(logs: updated, isOfflineData: false);
    _cacheService.saveLogs(_projectId!, updated);
  }

  void cleanup() {
    _logSub?.cancel();
    _connSub?.cancel();
    _connectivitySub?.cancel();
    _streamService.disconnect();
  }
}