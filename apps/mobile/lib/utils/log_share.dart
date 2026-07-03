import 'dart:convert';

import 'package:logstack_mobile/models/log.dart';

const _sensitiveKeys = {
  'password',
  'token',
  'apikey',
  'api_key',
  'secret',
  'authorization',
  'cookie',
  'creditcard',
  'credit_card',
  'ssn',
};

/// Human-readable summary for the native share sheet (default).
String formatLogForShare(Log log) {
  final buffer = StringBuffer()
    ..writeln('[${log.level.name.toUpperCase()}] ${log.message}')
    ..writeln('Time: ${log.createdAt.toIso8601String()}');
  if (log.source != null && log.source!.isNotEmpty) {
    buffer.writeln('Source: ${log.source}');
  }
  final meta = redactMetadata(log.metadata);
  if (meta.isNotEmpty) {
    buffer.writeln('Metadata: ${const JsonEncoder.withIndent('  ').convert(meta)}');
  }
  return buffer.toString().trim();
}

/// Redacted raw JSON for engineers (secondary copy option).
String formatLogRawJson(Log log) {
  return const JsonEncoder.withIndent('  ').convert({
    'id': log.id,
    'projectId': log.projectId,
    'level': log.level.name,
    'message': log.message,
    'source': log.source,
    'metadata': redactMetadata(log.metadata),
    'createdAt': log.createdAt.toIso8601String(),
  });
}

Map<String, dynamic> redactMetadata(Map<String, dynamic>? metadata) {
  if (metadata == null || metadata.isEmpty) return {};
  return _redactMap(Map<String, dynamic>.from(metadata));
}

Map<String, dynamic> _redactMap(Map<String, dynamic> input) {
  final out = <String, dynamic>{};
  for (final entry in input.entries) {
    final keyLower = entry.key.toLowerCase();
    if (_sensitiveKeys.any((s) => keyLower.contains(s))) {
      out[entry.key] = '[REDACTED]';
      continue;
    }
    final value = entry.value;
    if (value is Map) {
      out[entry.key] = _redactMap(Map<String, dynamic>.from(value));
    } else {
      out[entry.key] = value;
    }
  }
  return out;
}