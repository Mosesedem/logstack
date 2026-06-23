import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/log.dart';
import 'package:logstack_mobile/services/log_service.dart';
import 'package:logstack_mobile/providers/project_provider.dart';

final logsProvider = StateNotifierProvider<LogsNotifier, LogsState>((ref) {
  final logService = ref.watch(logServiceProvider);
  final projectState = ref.watch(projectProvider);
  return LogsNotifier(logService, projectState.currentProject?.id);
});

class LogsState {
  final List<Log> logs;
  final bool isLoading;
  final bool hasMore;
  final int offset;
  final String? error;
  final LogLevel? levelFilter;
  final String? searchQuery;

  LogsState({
    this.logs = const [],
    this.isLoading = false,
    this.hasMore = true,
    this.offset = 0,
    this.error,
    this.levelFilter,
    this.searchQuery,
  });

  LogsState copyWith({
    List<Log>? logs,
    bool? isLoading,
    bool? hasMore,
    int? offset,
    String? error,
    LogLevel? levelFilter,
    String? searchQuery,
  }) {
    return LogsState(
      logs: logs ?? this.logs,
      isLoading: isLoading ?? this.isLoading,
      hasMore: hasMore ?? this.hasMore,
      offset: offset ?? this.offset,
      error: error,
      levelFilter: levelFilter ?? this.levelFilter,
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }
}

class LogsNotifier extends StateNotifier<LogsState> {
  final LogService _logService;
  final String? _projectId;

  LogsNotifier(this._logService, this._projectId) : super(LogsState()) {
    if (_projectId != null) {
      loadLogs();
    }
  }

  Future<void> loadLogs() async {
    if (_projectId == null) return;

    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _logService.getLogs(
        projectId: _projectId!,
        level: state.levelFilter,
        search: state.searchQuery,
        offset: 0,
      );
      state = LogsState(
        logs: response.logs,
        hasMore: response.hasMore,
        offset: response.offset,
        levelFilter: state.levelFilter,
        searchQuery: state.searchQuery,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> loadMore() async {
    if (_projectId == null || !state.hasMore || state.isLoading) return;

    state = state.copyWith(isLoading: true);
    try {
      final response = await _logService.getLogs(
        projectId: _projectId!,
        level: state.levelFilter,
        search: state.searchQuery,
        offset: state.offset + 50,
      );
      state = state.copyWith(
        logs: [...state.logs, ...response.logs],
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

  void addRealtimeLog(Log log) {
    state = state.copyWith(logs: [log, ...state.logs]);
  }
}
