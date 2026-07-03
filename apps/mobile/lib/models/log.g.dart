// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'log.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$LogImpl _$$LogImplFromJson(Map<String, dynamic> json) => _$LogImpl(
      id: (json['id'] as num).toInt(),
      projectId: json['projectId'] as String,
      level: $enumDecode(_$LogLevelEnumMap, json['level']),
      message: json['message'] as String,
      source: json['source'] as String?,
      metadata: json['metadata'] as Map<String, dynamic>?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$$LogImplToJson(_$LogImpl instance) => <String, dynamic>{
      'id': instance.id,
      'projectId': instance.projectId,
      'level': _$LogLevelEnumMap[instance.level]!,
      'message': instance.message,
      'source': instance.source,
      'metadata': instance.metadata,
      'createdAt': instance.createdAt.toIso8601String(),
    };

const _$LogLevelEnumMap = {
  LogLevel.debug: 'debug',
  LogLevel.info: 'info',
  LogLevel.warn: 'warn',
  LogLevel.error: 'error',
  LogLevel.critical: 'critical',
  LogLevel.fatal: 'fatal',
};

_$LogsResponseImpl _$$LogsResponseImplFromJson(Map<String, dynamic> json) =>
    _$LogsResponseImpl(
      logs: (json['logs'] as List<dynamic>)
          .map((e) => Log.fromJson(e as Map<String, dynamic>))
          .toList(),
      hasMore: json['hasMore'] as bool,
      offset: (json['offset'] as num).toInt(),
      total: (json['total'] as num?)?.toInt(),
    );

Map<String, dynamic> _$$LogsResponseImplToJson(_$LogsResponseImpl instance) =>
    <String, dynamic>{
      'logs': instance.logs,
      'hasMore': instance.hasMore,
      'offset': instance.offset,
      'total': instance.total,
    };
