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
    final hostPort = _hostPort(uri, scheme);
    return '$scheme://$hostPort${uri.path}';
  }

  /// Avoid emitting invalid `:0` when the API URL uses implicit default ports.
  static String _hostPort(Uri uri, String wsScheme) {
    final port = uri.port;
    if (port == 0) return uri.host;
    if (wsScheme == 'wss' && port == 443) return uri.host;
    if (wsScheme == 'ws' && port == 80) return uri.host;
    return '${uri.host}:$port';
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