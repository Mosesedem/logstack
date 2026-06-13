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
    return response.map((a) => AlertRule.fromJson(a)).toList();
  }

  Future<AlertRule> createAlert(
      String projectId, Map<String, dynamic> data) async {
    return await _api.post(
      '/alerts?projectId=$projectId',
      data: data,
      fromJson: (data) => AlertRule.fromJson(data),
    );
  }

  Future<AlertRule> updateAlert(String id, Map<String, dynamic> data) async {
    return await _api.put(
      '/alerts/$id',
      data: data,
      fromJson: (data) => AlertRule.fromJson(data),
    );
  }

  Future<void> deleteAlert(String id) async {
    await _api.delete('/alerts/$id');
  }

  Future<List<AlertHistory>> getAlertHistory(String projectId) async {
    final response = await _api.get<List<dynamic>>(
      '/alerts/history',
      queryParameters: {'projectId': projectId},
    );
    return response.map((h) => AlertHistory.fromJson(h)).toList();
  }
}
