import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/alert.dart';
import 'package:logstack_mobile/services/api_client.dart';

final alertServiceProvider = Provider<AlertService>((ref) {
  final api = ref.watch(apiClientProvider);
  return AlertService(api);
});

class AlertService {
  final ApiClient _api;

  AlertService(this._api);

  Future<List<AlertRule>> getAlerts(String projectId) async {
    final response = await _api.get<List<dynamic>>(
      '/alerts',
      queryParameters: {'projectId': projectId},
    );
    return response
        .map((a) => AlertRule.fromJson(a as Map<String, dynamic>))
        .toList();
  }

  Future<AlertRule> createAlert(
      String projectId, Map<String, dynamic> data) async {
    return await _api.post(
      '/alerts',
      queryParameters: {'projectId': projectId},
      data: data,
      fromJson: (data) => AlertRule.fromJson(data as Map<String, dynamic>),
    );
  }

  Future<AlertRule> updateAlert(int id, Map<String, dynamic> data) async {
    return await _api.put(
      '/alerts/$id',
      data: data,
      fromJson: (data) => AlertRule.fromJson(data as Map<String, dynamic>),
    );
  }

  Future<void> deleteAlert(int id) async {
    await _api.delete('/alerts/$id');
  }

  /// Fetches delivery history for a single alert rule.
  Future<List<AlertHistory>> getAlertHistory(int ruleId, {int limit = 50}) async {
    final response = await _api.get<List<dynamic>>(
      '/alerts/$ruleId/history',
      queryParameters: {'limit': limit},
    );
    return response
        .map((h) => AlertHistory.fromJson(h as Map<String, dynamic>))
        .toList();
  }

  /// Aggregates history across all rules for a project (newest first).
  Future<List<AlertHistory>> getProjectAlertHistory(String projectId) async {
    final rules = await getAlerts(projectId);
    final all = <AlertHistory>[];
    for (final rule in rules) {
      try {
        final history = await getAlertHistory(rule.id, limit: 20);
        all.addAll(history);
      } catch (_) {
        // Skip rules we can't read history for
      }
    }
    all.sort((a, b) => b.sentAt.compareTo(a.sentAt));
    return all;
  }
}