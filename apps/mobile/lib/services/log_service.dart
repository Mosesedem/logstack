import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/log.dart';
import 'package:logstack_mobile/services/api_client.dart';

final logServiceProvider = Provider<LogService>((ref) {
  final api = ref.watch(apiClientProvider);
  return LogService(api);
});

class LogService {
  final ApiClient _api;

  LogService(this._api);

  Future<LogsResponse> getLogs({
    required String projectId,
    LogLevel? level,
    String? search,
    int offset = 0,
    int limit = 50,
  }) async {
    final queryParams = <String, dynamic>{
      'projectId': projectId,
      'offset': offset,
      'limit': limit,
    };

    if (level != null) {
      queryParams['level'] = level.name;
    }
    if (search != null && search.isNotEmpty) {
      queryParams['search'] = search;
    }

    return await _api.get(
      '/logs',
      queryParameters: queryParams,
      fromJson: (data) => LogsResponse.fromJson(data),
    );
  }

  Future<Log> getLog(String id) async {
    return await _api.get(
      '/logs/$id',
      fromJson: (data) => Log.fromJson(data),
    );
  }
}
