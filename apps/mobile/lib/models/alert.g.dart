// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'alert.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AlertRuleImpl _$$AlertRuleImplFromJson(Map<String, dynamic> json) =>
    _$AlertRuleImpl(
      id: json['id'] as String,
      projectId: json['projectId'] as String,
      name: json['name'] as String,
      level: $enumDecode(_$LogLevelEnumMap, json['level']),
      threshold: (json['threshold'] as num).toInt(),
      window: (json['window'] as num).toInt(),
      cooldown: (json['cooldown'] as num).toInt(),
      emailEnabled: json['emailEnabled'] as bool,
      pushEnabled: json['pushEnabled'] as bool,
      enabled: json['enabled'] as bool,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$$AlertRuleImplToJson(_$AlertRuleImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'projectId': instance.projectId,
      'name': instance.name,
      'level': _$LogLevelEnumMap[instance.level]!,
      'threshold': instance.threshold,
      'window': instance.window,
      'cooldown': instance.cooldown,
      'emailEnabled': instance.emailEnabled,
      'pushEnabled': instance.pushEnabled,
      'enabled': instance.enabled,
      'createdAt': instance.createdAt.toIso8601String(),
    };

const _$LogLevelEnumMap = {
  LogLevel.info: 'info',
  LogLevel.warn: 'warn',
  LogLevel.error: 'error',
  LogLevel.critical: 'critical',
};

_$AlertHistoryImpl _$$AlertHistoryImplFromJson(Map<String, dynamic> json) =>
    _$AlertHistoryImpl(
      id: json['id'] as String,
      ruleId: json['ruleId'] as String,
      ruleName: json['ruleName'] as String,
      level: $enumDecode(_$LogLevelEnumMap, json['level']),
      message: json['message'] as String,
      logCount: (json['logCount'] as num).toInt(),
      triggeredAt: DateTime.parse(json['triggeredAt'] as String),
    );

Map<String, dynamic> _$$AlertHistoryImplToJson(_$AlertHistoryImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'ruleId': instance.ruleId,
      'ruleName': instance.ruleName,
      'level': _$LogLevelEnumMap[instance.level]!,
      'message': instance.message,
      'logCount': instance.logCount,
      'triggeredAt': instance.triggeredAt.toIso8601String(),
    };
