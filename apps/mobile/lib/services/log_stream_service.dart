import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/config/app_config.dart';
import 'package:logstack_mobile/models/log.dart';
import 'package:logstack_mobile/services/auth_service.dart';
import 'package:logstack_mobile/services/storage_service.dart';
import 'package:web_socket_channel/io.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

enum StreamConnectionStatus {
  disconnected,
  connecting,
  connected,
  /// Gave up after repeated failures; REST logs still work.
  unavailable,
}

final logStreamServiceProvider = Provider<LogStreamService>((ref) {
  final storage = ref.watch(storageServiceProvider);
  final authService = ref.watch(authServiceProvider);
  final service = LogStreamService(storage, authService);
  ref.onDispose(service.dispose);
  return service;
});

class LogStreamService {
  LogStreamService(this._storage, this._authService);

  static const _maxFastRetries = 5;

  final StorageService _storage;
  final AuthService _authService;
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _reconnectTimer;
  String? _projectId;
  int _attempt = 0;
  int _consecutiveFailures = 0;
  bool _connecting = false;
  int _connectGeneration = 0;
  bool _emittedLiveForCurrent = false;
  Timer? _keepAliveTimer;

  final _statusController =
      StreamController<StreamConnectionStatus>.broadcast();
  final _logController = StreamController<Log>.broadcast();

  Stream<StreamConnectionStatus> get statusStream => _statusController.stream;
  Stream<Log> get logStream => _logController.stream;

  /// @deprecated Use [statusStream]; kept for quick migration.
  Stream<bool> get connectionStream =>
      statusStream.map((s) => s == StreamConnectionStatus.connected);

  Future<void> connect(String projectId) async {
    if (_projectId == projectId &&
        (_connecting || _channel != null)) {
      return;
    }
    final projectChanged = _projectId != projectId;
    await disconnect();
    _projectId = projectId;
    if (projectChanged) {
      _attempt = 0;
      _consecutiveFailures = 0;
    }
    _emittedLiveForCurrent = false;
    await _open();
  }

  Future<void> disconnect() async {
    _connectGeneration++;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    await _subscription?.cancel();
    _subscription = null;
    try {
      await _channel?.sink.close();
    } catch (_) {}
    _channel = null;
    _connecting = false;
    _emittedLiveForCurrent = false;
    _keepAliveTimer?.cancel();
    _keepAliveTimer = null;
    _statusController.add(StreamConnectionStatus.disconnected);
  }

  Future<void> retry() async {
    if (_projectId == null) return;
    await disconnect();
    _attempt = 0;
    _consecutiveFailures = 0;
    // disconnect already cancelled timer and reset emitted
    await _open();
  }

  Future<String?> _resolveAccessToken() async {
    try {
      final fresh = await _authService.refreshStoredAccessToken();
      await _storage.setToken(fresh);
      return fresh;
    } catch (_) {
      return _storage.getToken();
    }
  }

  Future<void> _open() async {
    final projectId = _projectId;
    if (projectId == null || _connecting) return;

    final token = await _resolveAccessToken();
    if (token == null || token.isEmpty) {
      _statusController.add(StreamConnectionStatus.unavailable);
      return;
    }

    final generation = ++_connectGeneration;
    _connecting = true;
    _emittedLiveForCurrent = false;
    _statusController.add(StreamConnectionStatus.connecting);

    final url = AppConfig.logStreamUrl(projectId: projectId, token: token);
    try {
      final channel = IOWebSocketChannel.connect(
        Uri.parse(url),
        headers: {'Authorization': 'Bearer $token'},
      );
      _subscription = channel.stream.listen(
        _onMessage,
        onError: (_) => _scheduleReconnect(),
        onDone: _scheduleReconnect,
        cancelOnError: true,
      );

      // Do not block or fail the connection attempt solely on ready.
      // Some platforms/networks deliver data before ready completes, or ready
      // can be slow. We use data arrival (in _onMessage) as authoritative for "live".
      // Only reconnect on ready failure if we have received NO data yet for this attempt.
      unawaited(
        channel.ready.timeout(const Duration(seconds: 12)).then((_) {
          if (generation != _connectGeneration || _projectId != projectId) {
            return;
          }
          _channel = channel;
          _connecting = false;
          _attempt = 0;
          _consecutiveFailures = 0;
          if (!_emittedLiveForCurrent) {
            _emittedLiveForCurrent = true;
            _statusController.add(StreamConnectionStatus.connected);
          }
          _startKeepAlive();
        }).catchError((_) {
          if (generation != _connectGeneration || _projectId != projectId) {
            return;
          }
          if (!_emittedLiveForCurrent) {
            // No data received yet — treat as failure and reconnect.
            _connecting = false;
            _scheduleReconnect();
          } else {
            // Data is already flowing (promoted in _onMessage). Keep this channel
            // even though ready did not complete.
            _channel = channel;
            _connecting = false;
            _startKeepAlive();
          }
        }),
      );
    } catch (_) {
      _connecting = false;
      if (generation == _connectGeneration) {
        _scheduleReconnect();
      }
    }
  }

  void _onMessage(dynamic event) {
    try {
      // If data is flowing over the socket, the live stream is connected.
      // This ensures "Live stream connected" is shown even if channel.ready
      // is slow to resolve on some platforms/networks.
      if (!_emittedLiveForCurrent) {
        _emittedLiveForCurrent = true;
        _statusController.add(StreamConnectionStatus.connected);
        _startKeepAlive();
      }

      // Server WritePump may batch multiple logs into one frame separated by \n.
      // Split and parse each to avoid dropping logs.
      final raw = event as String;
      for (final line in raw.split('\n')) {
        final trimmed = line.trim();
        if (trimmed.isEmpty) continue;
        final map = jsonDecode(trimmed) as Map<String, dynamic>;
        _logController.add(Log.fromJson(map));
      }
    } catch (_) {
      // Ignore malformed frames
    }
  }

  void _scheduleReconnect() {
    if (_connecting) return;
    _subscription?.cancel();
    _subscription = null;
    _channel = null;
    _emittedLiveForCurrent = false;
    _keepAliveTimer?.cancel();
    _keepAliveTimer = null;

    if (_projectId == null) {
      _statusController.add(StreamConnectionStatus.disconnected);
      return;
    }

    _attempt++;
    _consecutiveFailures++;
    if (_consecutiveFailures >= _maxFastRetries) {
      _statusController.add(StreamConnectionStatus.unavailable);
      _reconnectTimer?.cancel();
      _reconnectTimer = Timer(const Duration(seconds: 60), () {
        _consecutiveFailures = _maxFastRetries - 1;
        _open();
      });
      return;
    }

    _statusController.add(StreamConnectionStatus.disconnected);
    _reconnectTimer?.cancel();
    final delay = Duration(seconds: (1 << _attempt.clamp(0, 4)).clamp(1, 16));
    _reconnectTimer = Timer(delay, _open);
  }

  void dispose() {
    disconnect();
    _statusController.close();
    _logController.close();
  }

  void _startKeepAlive() {
    _keepAliveTimer?.cancel();
    _keepAliveTimer = Timer.periodic(const Duration(seconds: 25), (_) {
      if (_channel != null && _emittedLiveForCurrent) {
        try {
          // Send a lightweight ping to keep the server read deadline and conn alive.
          // Server ReadPump will receive it and keep the connection healthy.
          _channel!.sink.add('{"type":"ping"}');
        } catch (_) {}
      }
    });
  }
}