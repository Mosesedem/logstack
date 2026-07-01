/// Runtime configuration for API and WebSocket endpoints.
///
/// Override at build/run time:
/// `flutter run --dart-define=LOGSTACK_API_URL=https://api.logstack.tech/v1`
abstract final class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'LOGSTACK_API_URL',
    defaultValue: 'https://api.logstack.tech/v1',
  );

  static String get webSocketBaseUrl {
    final uri = Uri.parse(apiBaseUrl);
    final scheme = uri.scheme == 'https' ? 'wss' : 'ws';
    return '$scheme://${uri.host}${uri.hasPort ? ':${uri.port}' : ''}${uri.path}';
  }

  static String logStreamUrl({
    required String projectId,
    required String token,
  }) {
    final params = Uri(queryParameters: {
      'projectId': projectId,
      'token': token,
    });
    return '$webSocketBaseUrl/stream?${params.query}';
  }
}