import 'package:freezed_annotation/freezed_annotation.dart';

part 'log.freezed.dart';
part 'log.g.dart';

enum LogLevel {
  @JsonValue('debug')
  debug,
  @JsonValue('info')
  info,
  @JsonValue('warn')
  warn,
  @JsonValue('error')
  error,
  @JsonValue('critical')
  critical,
  @JsonValue('fatal')
  fatal,
}

@freezed
class Log with _$Log {
  const factory Log({
    required int id,
    required String projectId,
    required LogLevel level,
    required String message,
    String? source,
    Map<String, dynamic>? metadata,
    required DateTime createdAt,
  }) = _Log;

  factory Log.fromJson(Map<String, dynamic> json) => _$LogFromJson(json);
}

@freezed
class LogsResponse with _$LogsResponse {
  const factory LogsResponse({
    required List<Log> logs,
    required bool hasMore,
    required int offset,
    int? total,
  }) = _LogsResponse;

  factory LogsResponse.fromJson(Map<String, dynamic> json) =>
      _$LogsResponseFromJson(json);
}