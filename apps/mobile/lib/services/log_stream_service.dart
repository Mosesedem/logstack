import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/config/app_config.dart';
import 'package:logstack_mobile/models/log.dart';
import 'package:logstack_mobile/services/storage_service.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

final logStreamServiceProvider = Provider<LogStreamService>((ref) {
  final storage = ref.watch(storageServiceProvider);
  final service = LogStreamService(storage);
  ref.onDispose(service.dispose);
  return service;
});

class LogStreamService {
  LogStreamService(this._storage);

  final StorageService _storage;
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _reconnectTimer;
  String? _projectId;
  int _attempt = 0;
  bool _connecting = false;
  int _connectGeneration = 0;

  final _connectionController = StreamController<bool>.broadcast();
  final _logController = StreamController<Log>.broadcast();

  Stream<bool> get connectionStream => _connectionController.stream;
  Stream<Log> get logStream => _logController.stream;

  Future<void> connect(String projectId) async {
    if (_projectId == projectId && (_connecting || _channel != null)) return;
    await disconnect();
    _projectId = projectId;
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
    _connectionController.add(false);
  }

  Future<void> _open() async {
    final projectId = _projectId;
    if (projectId == null || _connecting) return;

    final token = await _storage.getToken();
    if (token == null) {
      _connectionController.add(false);
      return;
    }

    final generation = ++_connectGeneration;
    _connecting = true;
    _connectionController.add(false);

    final url = AppConfig.logStreamUrl(projectId: projectId, token: token);
    try {
      final channel = WebSocketChannel.connect(Uri.parse(url));
      _subscription = channel.stream.listen(
        _onMessage,
        onError: (_) => _scheduleReconnect(),
        onDone: _scheduleReconnect,
        cancelOnError: true,
      );

      await channel.ready.timeout(const Duration(seconds: 12));
      if (generation != _connectGeneration || _projectId != projectId) {
        await _subscription?.cancel();
        return;
      }

      _channel = channel;
      _connecting = false;
      _attempt = 0;
      _connectionController.add(true);
    } catch (_) {
      _connecting = false;
      if (generation == _connectGeneration) {
        _scheduleReconnect();
      }
    }
  }

  void _onMessage(dynamic event) {
    try {
      final map = jsonDecode(event as String) as Map<String, dynamic>;
      _logController.add(Log.fromJson(map));
    } catch (_) {
      // Ignore malformed frames
    }
  }

  void _scheduleReconnect() {
    if (_connecting) return;
    _connectionController.add(false);
    _subscription?.cancel();
    _subscription = null;
    _channel = null;

    if (_projectId == null) return;
    _reconnectTimer?.cancel();
    final delay = Duration(seconds: (1 << _attempt.clamp(0, 4)).clamp(1, 16));
    _attempt++;
    _reconnectTimer = Timer(delay, _open);
  }

  void dispose() {
    disconnect();
    _connectionController.close();
    _logController.close();
  }
}