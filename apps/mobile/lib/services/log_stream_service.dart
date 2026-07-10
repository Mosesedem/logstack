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

  /// After this many consecutive open failures, stop spinning and show
  /// "unavailable" until the user taps Retry (or a 90s background retry).
  static const _maxFastRetries = 4;

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
  StreamConnectionStatus _lastStatus = StreamConnectionStatus.disconnected;

  final _statusController =
      StreamController<StreamConnectionStatus>.broadcast();
  final _logController = StreamController<Log>.broadcast();

  Stream<StreamConnectionStatus> get statusStream => _statusController.stream;
  Stream<Log> get logStream => _logController.stream;

  /// Current connection status (for late subscribers / debugging).
  StreamConnectionStatus get currentStatus => _lastStatus;

  /// @deprecated Use [statusStream]; kept for quick migration.
  Stream<bool> get connectionStream =>
      statusStream.map((s) => s == StreamConnectionStatus.connected);

  bool get isConnected =>
      _emittedLiveForCurrent && _channel != null && !_connecting;

  Future<void> connect(String projectId) async {
    // Already live on this project — do not tear down a working socket.
    if (_projectId == projectId && isConnected) {
      _emitStatus(StreamConnectionStatus.connected);
      return;
    }
    // Handshake in flight for same project — leave it alone.
    if (_projectId == projectId && _connecting) {
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
    _emitStatus(StreamConnectionStatus.disconnected);
  }

  Future<void> retry() async {
    if (_projectId == null) return;
    final projectId = _projectId!;
    await disconnect();
    _attempt = 0;
    _consecutiveFailures = 0;
    _projectId = projectId;
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

  void _emitStatus(StreamConnectionStatus status) {
    if (_lastStatus == status && status != StreamConnectionStatus.connected) {
      // Still re-emit connected when data proves live so late UI recovers.
      return;
    }
    // Always re-emit connected so UI recovers from reconnecting/unavailable.
    if (status == StreamConnectionStatus.connected || _lastStatus != status) {
      _lastStatus = status;
      if (!_statusController.isClosed) {
        _statusController.add(status);
      }
    }
  }

  Future<void> _open() async {
    final projectId = _projectId;
    if (projectId == null) return;
    if (_connecting) return;

    final token = await _resolveAccessToken();
    if (token == null || token.isEmpty) {
      _emitStatus(StreamConnectionStatus.unavailable);
      return;
    }

    final generation = ++_connectGeneration;
    _connecting = true;
    _emittedLiveForCurrent = false;
    _emitStatus(StreamConnectionStatus.connecting);

    final url = AppConfig.logStreamUrl(projectId: projectId, token: token);
    try {
      final channel = IOWebSocketChannel.connect(
        Uri.parse(url),
        headers: {'Authorization': 'Bearer $token'},
      );
      // Assign immediately so isConnected / keepAlive / connect() early-exit work
      // even if channel.ready is slow or flaky on some platforms.
      _channel = channel;

      _subscription = channel.stream.listen(
        (event) {
          if (generation != _connectGeneration) return;
          _onMessage(event);
        },
        onError: (_) {
          if (generation != _connectGeneration) return;
          _connecting = false;
          _scheduleReconnect();
        },
        onDone: () {
          if (generation != _connectGeneration) return;
          _connecting = false;
          _scheduleReconnect();
        },
        cancelOnError: true,
      );

      // ready is best-effort. Data arrival is authoritative for "live".
      unawaited(
        channel.ready.timeout(const Duration(seconds: 20)).then((_) {
          if (generation != _connectGeneration || _projectId != projectId) {
            return;
          }
          _connecting = false;
          _attempt = 0;
          _consecutiveFailures = 0;
          _markLive();
        }).catchError((_) {
          if (generation != _connectGeneration || _projectId != projectId) {
            return;
          }
          _connecting = false;
          if (_emittedLiveForCurrent) {
            // Frames already flowing — keep the socket.
            _startKeepAlive();
            return;
          }
          // No frames yet and ready failed — reconnect.
          _scheduleReconnect();
        }),
      );
    } catch (_) {
      _connecting = false;
      _channel = null;
      if (generation == _connectGeneration) {
        _scheduleReconnect();
      }
    }
  }

  void _markLive() {
    final wasLive = _emittedLiveForCurrent;
    _emittedLiveForCurrent = true;
    _attempt = 0;
    _consecutiveFailures = 0;
    _emitStatus(StreamConnectionStatus.connected);
    if (!wasLive) {
      _startKeepAlive();
    }
  }

  void _onMessage(dynamic event) {
    // Any frame (log or otherwise) means the socket is alive.
    _markLive();

    try {
      final raw = event is String
          ? event
          : (event is List<int> ? utf8.decode(event) : event.toString());

      // Server WritePump may batch multiple logs into one frame separated by \n.
      for (final line in raw.split('\n')) {
        final trimmed = line.trim();
        if (trimmed.isEmpty) continue;

        final decoded = jsonDecode(trimmed);
        if (decoded is! Map<String, dynamic>) continue;

        // Server control frames e.g. {"type":"error",...}
        if (decoded.containsKey('type') && !decoded.containsKey('id')) {
          continue;
        }

        _logController.add(Log.fromJson(decoded));
      }
    } catch (_) {
      // Ignore malformed frames — still counted as live above.
    }
  }

  void _scheduleReconnect() {
    _subscription?.cancel();
    _subscription = null;
    try {
      _channel?.sink.close();
    } catch (_) {}
    _channel = null;
    _emittedLiveForCurrent = false;
    _keepAliveTimer?.cancel();
    _keepAliveTimer = null;
    _connecting = false;

    if (_projectId == null) {
      _emitStatus(StreamConnectionStatus.disconnected);
      return;
    }

    _attempt++;
    _consecutiveFailures++;
    if (_consecutiveFailures >= _maxFastRetries) {
      // Stop the infinite "Reconnecting…" loop. REST logs still work.
      _emitStatus(StreamConnectionStatus.unavailable);
      _reconnectTimer?.cancel();
      // Quiet background retry only — does not flip UI back to "Reconnecting…"
      // until the socket actually connects (or user taps Retry).
      _reconnectTimer = Timer(const Duration(seconds: 90), () {
        if (_projectId == null) return;
        // Keep consecutiveFailures high so failed background opens stay unavailable
        // rather than thrashing the banner; only a successful _markLive resets it.
        _attempt = 0;
        unawaited(_openQuiet());
      });
      return;
    }

    // Show connecting (not ambiguous disconnected) so the banner can time out.
    _emitStatus(StreamConnectionStatus.connecting);
    _reconnectTimer?.cancel();
    final delay = Duration(seconds: (1 << (_attempt - 1).clamp(0, 3)).clamp(1, 8));
    _reconnectTimer = Timer(delay, () {
      unawaited(_open());
    });
  }

  /// Background re-open while UI already shows "unavailable". Does not emit
  /// connecting (avoids bouncing the banner), only connected or stay unavailable.
  Future<void> _openQuiet() async {
    final projectId = _projectId;
    if (projectId == null || _connecting) return;

    final token = await _resolveAccessToken();
    if (token == null || token.isEmpty) {
      _emitStatus(StreamConnectionStatus.unavailable);
      return;
    }

    final generation = ++_connectGeneration;
    _connecting = true;

    final url = AppConfig.logStreamUrl(projectId: projectId, token: token);
    try {
      final channel = IOWebSocketChannel.connect(
        Uri.parse(url),
        headers: {'Authorization': 'Bearer $token'},
      );
      _channel = channel;
      _subscription = channel.stream.listen(
        (event) {
          if (generation != _connectGeneration) return;
          _onMessage(event);
        },
        onError: (_) {
          if (generation != _connectGeneration) return;
          _connecting = false;
          _emitStatus(StreamConnectionStatus.unavailable);
          _scheduleQuietRetry();
        },
        onDone: () {
          if (generation != _connectGeneration) return;
          _connecting = false;
          _emitStatus(StreamConnectionStatus.unavailable);
          _scheduleQuietRetry();
        },
        cancelOnError: true,
      );

      unawaited(
        channel.ready.timeout(const Duration(seconds: 15)).then((_) {
          if (generation != _connectGeneration || _projectId != projectId) {
            return;
          }
          _connecting = false;
          _markLive();
        }).catchError((_) {
          if (generation != _connectGeneration || _projectId != projectId) {
            return;
          }
          _connecting = false;
          if (_emittedLiveForCurrent) {
            _startKeepAlive();
            return;
          }
          _emitStatus(StreamConnectionStatus.unavailable);
          _scheduleQuietRetry();
        }),
      );
    } catch (_) {
      _connecting = false;
      _channel = null;
      if (generation == _connectGeneration) {
        _emitStatus(StreamConnectionStatus.unavailable);
        _scheduleQuietRetry();
      }
    }
  }

  void _scheduleQuietRetry() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 90), () {
      if (_projectId != null && !_emittedLiveForCurrent) {
        unawaited(_openQuiet());
      }
    });
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
          // Application-level ping — server ReadPump should reset its deadline
          // on any inbound frame (see packages/logstack-go websocket client).
          _channel!.sink.add('{"type":"ping"}');
        } catch (_) {}
      }
    });
  }
}
