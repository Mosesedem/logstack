// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'alert.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AlertRuleImpl _$$AlertRuleImplFromJson(Map<String, dynamic> json) =>
    _$AlertRuleImpl(
      id: (json['id'] as num).toInt(),
      projectId: json['projectId'] as String,
      name: json['name'] as String,
      triggerPatterns: (json['triggerPatterns'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      triggerLevel:
          $enumDecodeNullable(_$LogLevelEnumMap, json['triggerLevel']),
      channels: (json['channels'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      recipient: json['recipient'] as String,
      cooldownMinutes: (json['cooldownMinutes'] as num?)?.toInt() ?? 15,
      enabled: json['enabled'] as bool? ?? true,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: json['updatedAt'] == null
          ? null
          : DateTime.parse(json['updatedAt'] as String),
    );

Map<String, dynamic> _$$AlertRuleImplToJson(_$AlertRuleImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'projectId': instance.projectId,
      'name': instance.name,
      'triggerPatterns': instance.triggerPatterns,
      'triggerLevel': _$LogLevelEnumMap[instance.triggerLevel],
      'channels': instance.channels,
      'recipient': instance.recipient,
      'cooldownMinutes': instance.cooldownMinutes,
      'enabled': instance.enabled,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };

const _$LogLevelEnumMap = {
  LogLevel.debug: 'debug',
  LogLevel.info: 'info',
  LogLevel.warn: 'warn',
  LogLevel.error: 'error',
  LogLevel.critical: 'critical',
  LogLevel.fatal: 'fatal',
};

_$AlertHistoryImpl _$$AlertHistoryImplFromJson(Map<String, dynamic> json) =>
    _$AlertHistoryImpl(
      id: (json['id'] as num).toInt(),
      alertRuleId: (json['alertRuleId'] as num).toInt(),
      logId: (json['logId'] as num?)?.toInt(),
      sentAt: DateTime.parse(json['sentAt'] as String),
      status: json['status'] as String,
      errorMessage: json['errorMessage'] as String?,
      log: json['log'] == null
          ? null
          : Log.fromJson(json['log'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$AlertHistoryImplToJson(_$AlertHistoryImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'alertRuleId': instance.alertRuleId,
      'logId': instance.logId,
      'sentAt': instance.sentAt.toIso8601String(),
      'status': instance.status,
      'errorMessage': instance.errorMessage,
      'log': instance.log,
    };
