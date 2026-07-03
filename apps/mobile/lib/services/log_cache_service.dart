import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:logstack_mobile/models/log.dart';

final logCacheServiceProvider = Provider<LogCacheService>((ref) {
  return LogCacheService();
});

class LogCacheService {
  static const _boxName = 'log_cache_v1';
  static const _maxPerProject = 200;

  Future<Box<String>> _box() => Hive.openBox<String>(_boxName);

  String _key(String projectId) => 'project:$projectId';

  Future<void> saveLogs(String projectId, List<Log> logs) async {
    final box = await _box();
    final merged = <String, Log>{
      for (final log in await getLogs(projectId)) log.id.toString(): log,
      for (final log in logs) log.id.toString(): log,
    };
    final sorted = merged.values.toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    final trimmed = sorted.take(_maxPerProject).toList();
    await box.put(
      _key(projectId),
      jsonEncode(trimmed.map((l) => l.toJson()).toList()),
    );
  }

  Future<List<Log>> getLogs(String projectId) async {
    final box = await _box();
    final raw = box.get(_key(projectId));
    if (raw == null) return [];
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .map((e) => Log.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<void> clearAll() async {
    final box = await _box();
    await box.clear();
  }

  List<Log> filterLocal({
    required List<Log> logs,
    LogLevel? level,
    String? search,
  }) {
    return logs.where((log) {
      if (level != null && log.level != level) return false;
      if (search != null && search.isNotEmpty) {
        final q = search.toLowerCase();
        final haystack = '${log.message} ${log.source ?? ''}'.toLowerCase();
        if (!haystack.contains(q)) return false;
      }
      return true;
    }).toList();
  }
}