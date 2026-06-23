import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/alert.dart';
import 'package:logstack_mobile/services/alert_service.dart';
import 'package:logstack_mobile/providers/project_provider.dart';

final alertsProvider =
    StateNotifierProvider<AlertsNotifier, AlertsState>((ref) {
  final alertService = ref.watch(alertServiceProvider);
  final projectState = ref.watch(projectProvider);
  return AlertsNotifier(alertService, projectState.currentProject?.id);
});

class AlertsState {
  final List<AlertRule> rules;
  final List<AlertHistory> history;
  final bool isLoading;
  final String? error;

  AlertsState({
    this.rules = const [],
    this.history = const [],
    this.isLoading = false,
    this.error,
  });

  AlertsState copyWith({
    List<AlertRule>? rules,
    List<AlertHistory>? history,
    bool? isLoading,
    String? error,
  }) {
    return AlertsState(
      rules: rules ?? this.rules,
      history: history ?? this.history,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class AlertsNotifier extends StateNotifier<AlertsState> {
  final AlertService _alertService;
  final String? _projectId;

  AlertsNotifier(this._alertService, this._projectId) : super(AlertsState()) {
    if (_projectId != null) {
      loadAlerts();
    }
  }

  Future<void> loadAlerts() async {
    if (_projectId == null) return;

    state = state.copyWith(isLoading: true, error: null);
    try {
      final rules = await _alertService.getAlerts(_projectId!);
      final history = await _alertService.getAlertHistory(_projectId!);
      state = AlertsState(rules: rules, history: history);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> createAlert(Map<String, dynamic> data) async {
    if (_projectId == null) return;

    final alert = await _alertService.createAlert(_projectId!, data);
    state = state.copyWith(rules: [...state.rules, alert]);
  }

  Future<void> updateAlert(String id, Map<String, dynamic> data) async {
    final alert = await _alertService.updateAlert(id, data);
    final rules = state.rules.map((r) => r.id == id ? alert : r).toList();
    state = state.copyWith(rules: rules);
  }

  Future<void> deleteAlert(String id) async {
    await _alertService.deleteAlert(id);
    final rules = state.rules.where((r) => r.id != id).toList();
    state = state.copyWith(rules: rules);
  }

  Future<void> toggleAlert(String id, bool enabled) async {
    await updateAlert(id, {'enabled': enabled});
  }
}
