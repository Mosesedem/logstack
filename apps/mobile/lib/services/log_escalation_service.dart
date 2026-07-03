import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/services/api_client.dart';

final logEscalationServiceProvider = Provider<LogEscalationService>((ref) {
  return LogEscalationService(ref.watch(apiClientProvider));
});

class EscalationResult {
  final bool escalated;
  final bool alreadyDone;
  final List<String> notified;
  final String message;

  const EscalationResult({
    required this.escalated,
    required this.alreadyDone,
    required this.notified,
    required this.message,
  });

  factory EscalationResult.fromJson(Map<String, dynamic> json) {
    return EscalationResult(
      escalated: json['escalated'] as bool? ?? false,
      alreadyDone: json['alreadyDone'] as bool? ?? false,
      notified: (json['notified'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      message: json['message'] as String? ?? '',
    );
  }
}

class LogEscalationService {
  final ApiClient _api;

  LogEscalationService(this._api);

  Future<EscalationResult> escalate({
    required String projectId,
    required int logId,
  }) async {
    final data = await _api.post<Map<String, dynamic>>(
      '/projects/$projectId/logs/$logId/escalate',
      data: {},
    );
    return EscalationResult.fromJson(data);
  }
}