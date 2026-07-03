// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'project.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ProjectImpl _$$ProjectImplFromJson(Map<String, dynamic> json) =>
    _$ProjectImpl(
      id: json['id'] as String,
      ownerId: (json['ownerId'] as num).toInt(),
      name: json['name'] as String,
      apiKey: json['apiKey'] as String?,
      environment: json['environment'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$$ProjectImplToJson(_$ProjectImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'ownerId': instance.ownerId,
      'name': instance.name,
      'apiKey': instance.apiKey,
      'environment': instance.environment,
      'createdAt': instance.createdAt.toIso8601String(),
    };
