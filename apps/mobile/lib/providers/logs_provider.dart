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
  /// WebSocket is open and passing the handshake (see [LogStreamService]).
  final bool isLive;
  /// Device has no network connectivity.
  final bool isDeviceOffline;
  /// REST fetch failed or device offline — list may be stale cache.
  final bool isShowingCachedLogs;

  const LogsState({
    this.logs = const [],
    this.isLoading = false,
    this.hasMore = true,
    this.offset = 0,
    this.error,
    this.levelFilter,
    this.searchQuery,
    this.isLive = false,
    this.isDeviceOffline = false,
    this.isShowingCachedLogs = false,
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
    bool? isDeviceOffline,
    bool? isShowingCachedLogs,
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
      isDeviceOffline: isDeviceOffline ?? this.isDeviceOffline,
      isShowingCachedLogs: isShowingCachedLogs ?? this.isShowingCachedLogs,
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
  bool _disposed = false;

  StreamSubscription<Log>? _logSub;
  StreamSubscription<bool>? _connSub;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  Timer? _connectivityDebounce;

  void _setState(LogsState newState) {
    if (_disposed) return;
    state = newState;
  }

  void _patchState(LogsState Function(LogsState) patch) {
    if (_disposed) return;
    state = patch(state);
  }

  Future<void> _init() async {
    _logSub = _streamService.logStream.listen(_onRealtimeLog);
    _connSub = _streamService.connectionStream.listen((live) {
      _patchState((s) => s.copyWith(isLive: live));
    });
    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      final online = !results.contains(ConnectivityResult.none);
      _patchState((s) => s.copyWith(isDeviceOffline: !online));
      _connectivityDebounce?.cancel();
      _connectivityDebounce = Timer(const Duration(milliseconds: 800), () {
        if (_disposed) return;
        if (online && _projectId != null) {
          unawaited(_streamService.connect(_projectId!));
        }
        loadLogs();
      });
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
      _setState(const LogsState());
      return;
    }
    _startForProject(projectId);
  }

  Future<void> _startForProject(String projectId) async {
    final connectivity = await Connectivity().checkConnectivity();
    final online = !connectivity.contains(ConnectivityResult.none);

    final cached = await _cacheService.getLogs(projectId);
    final filtered = _cacheService.filterLocal(
      logs: cached,
      level: state.levelFilter,
      search: state.searchQuery,
    );
    _setState(LogsState(
      logs: filtered,
      levelFilter: state.levelFilter,
      searchQuery: state.searchQuery,
      isDeviceOffline: !online,
      isShowingCachedLogs: !online && filtered.isNotEmpty,
      isLive: false,
    ));
    if (_disposed) return;
    if (online) {
      await _streamService.connect(projectId);
    }
    if (_disposed) return;
    await loadLogs();
  }

  Future<void> loadLogs() async {
    if (_projectId == null) return;

    final connectivity = await Connectivity().checkConnectivity();
    final online = !connectivity.contains(ConnectivityResult.none);

    if (!online) {
      final cached = await _cacheService.getLogs(_projectId!);
      _patchState((s) => s.copyWith(
            logs: _cacheService.filterLocal(
              logs: cached,
              level: s.levelFilter,
              search: s.searchQuery,
            ),
            isLoading: false,
            isDeviceOffline: true,
            isShowingCachedLogs: cached.isNotEmpty,
            clearError: true,
          ));
      return;
    }

    _patchState((s) => s.copyWith(
          isLoading: true,
          isDeviceOffline: false,
          clearError: true,
        ));
    try {
      final response = await _logService.getLogs(
        projectId: _projectId!,
        level: state.levelFilter,
        search: state.searchQuery,
        offset: 0,
      );
      if (_disposed) return;
      await _cacheService.saveLogs(_projectId!, response.logs);
      _patchState((s) => s.copyWith(
            logs: response.logs,
            hasMore: response.hasMore,
            offset: response.offset,
            isLoading: false,
            isShowingCachedLogs: false,
          ));
    } catch (e) {
      if (_disposed) return;
      final cached = await _cacheService.getLogs(_projectId!);
      _patchState((s) => s.copyWith(
            isLoading: false,
            error: e.toString().replaceAll('Exception: ', ''),
            logs: _cacheService.filterLocal(
              logs: cached,
              level: s.levelFilter,
              search: s.searchQuery,
            ),
            isShowingCachedLogs: cached.isNotEmpty,
          ));
    }
  }

  Future<void> loadMore() async {
    if (_projectId == null ||
        !state.hasMore ||
        state.isLoading ||
        state.isShowingCachedLogs ||
        state.isDeviceOffline) {
      return;
    }

    _patchState((s) => s.copyWith(isLoading: true));
    try {
      final response = await _logService.getLogs(
        projectId: _projectId!,
        level: state.levelFilter,
        search: state.searchQuery,
        offset: state.offset + 50,
      );
      if (_disposed) return;
      final merged = [...state.logs, ...response.logs];
      await _cacheService.saveLogs(_projectId!, merged);
      _patchState((s) => s.copyWith(
            logs: merged,
            hasMore: response.hasMore,
            offset: response.offset,
            isLoading: false,
          ));
    } catch (e) {
      _patchState((s) => s.copyWith(isLoading: false, error: e.toString()));
    }
  }

  void setLevelFilter(LogLevel? level) {
    _patchState((s) => s.copyWith(levelFilter: level));
    loadLogs();
  }

  void setSearchQuery(String? query) {
    _patchState((s) => s.copyWith(searchQuery: query));
    loadLogs();
  }

  void _onRealtimeLog(Log log) {
    if (_disposed || _projectId == null || log.projectId != _projectId) return;
    if (state.levelFilter != null && log.level != state.levelFilter) return;
    if (state.searchQuery != null &&
        state.searchQuery!.isNotEmpty &&
        !log.message.toLowerCase().contains(state.searchQuery!.toLowerCase())) {
      return;
    }
    final exists = state.logs.any((l) => l.id == log.id);
    if (exists) return;
    final updated = [log, ...state.logs].take(200).toList();
    _patchState((s) => s.copyWith(
          logs: updated,
          isShowingCachedLogs: false,
        ));
    _cacheService.saveLogs(_projectId!, updated);
  }

  void cleanup() {
    _disposed = true;
    _connectivityDebounce?.cancel();
    _logSub?.cancel();
    _connSub?.cancel();
    _connectivitySub?.cancel();
    _streamService.disconnect();
  }
}