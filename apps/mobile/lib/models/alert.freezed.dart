// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'alert.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AlertRule _$AlertRuleFromJson(Map<String, dynamic> json) {
  return _AlertRule.fromJson(json);
}

/// @nodoc
mixin _$AlertRule {
  int get id => throw _privateConstructorUsedError;
  String get projectId => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  List<String> get triggerPatterns => throw _privateConstructorUsedError;
  LogLevel? get triggerLevel => throw _privateConstructorUsedError;
  List<String> get channels => throw _privateConstructorUsedError;
  String get recipient => throw _privateConstructorUsedError;
  int get cooldownMinutes => throw _privateConstructorUsedError;
  bool get enabled => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $AlertRuleCopyWith<AlertRule> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AlertRuleCopyWith<$Res> {
  factory $AlertRuleCopyWith(AlertRule value, $Res Function(AlertRule) then) =
      _$AlertRuleCopyWithImpl<$Res, AlertRule>;
  @useResult
  $Res call(
      {int id,
      String projectId,
      String name,
      List<String> triggerPatterns,
      LogLevel? triggerLevel,
      List<String> channels,
      String recipient,
      int cooldownMinutes,
      bool enabled,
      DateTime createdAt,
      DateTime? updatedAt});
}

/// @nodoc
class _$AlertRuleCopyWithImpl<$Res, $Val extends AlertRule>
    implements $AlertRuleCopyWith<$Res> {
  _$AlertRuleCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? projectId = null,
    Object? name = null,
    Object? triggerPatterns = null,
    Object? triggerLevel = freezed,
    Object? channels = null,
    Object? recipient = null,
    Object? cooldownMinutes = null,
    Object? enabled = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as int,
      projectId: null == projectId
          ? _value.projectId
          : projectId // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      triggerPatterns: null == triggerPatterns
          ? _value.triggerPatterns
          : triggerPatterns // ignore: cast_nullable_to_non_nullable
              as List<String>,
      triggerLevel: freezed == triggerLevel
          ? _value.triggerLevel
          : triggerLevel // ignore: cast_nullable_to_non_nullable
              as LogLevel?,
      channels: null == channels
          ? _value.channels
          : channels // ignore: cast_nullable_to_non_nullable
              as List<String>,
      recipient: null == recipient
          ? _value.recipient
          : recipient // ignore: cast_nullable_to_non_nullable
              as String,
      cooldownMinutes: null == cooldownMinutes
          ? _value.cooldownMinutes
          : cooldownMinutes // ignore: cast_nullable_to_non_nullable
              as int,
      enabled: null == enabled
          ? _value.enabled
          : enabled // ignore: cast_nullable_to_non_nullable
              as bool,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AlertRuleImplCopyWith<$Res>
    implements $AlertRuleCopyWith<$Res> {
  factory _$$AlertRuleImplCopyWith(
          _$AlertRuleImpl value, $Res Function(_$AlertRuleImpl) then) =
      __$$AlertRuleImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {int id,
      String projectId,
      String name,
      List<String> triggerPatterns,
      LogLevel? triggerLevel,
      List<String> channels,
      String recipient,
      int cooldownMinutes,
      bool enabled,
      DateTime createdAt,
      DateTime? updatedAt});
}

/// @nodoc
class __$$AlertRuleImplCopyWithImpl<$Res>
    extends _$AlertRuleCopyWithImpl<$Res, _$AlertRuleImpl>
    implements _$$AlertRuleImplCopyWith<$Res> {
  __$$AlertRuleImplCopyWithImpl(
      _$AlertRuleImpl _value, $Res Function(_$AlertRuleImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? projectId = null,
    Object? name = null,
    Object? triggerPatterns = null,
    Object? triggerLevel = freezed,
    Object? channels = null,
    Object? recipient = null,
    Object? cooldownMinutes = null,
    Object? enabled = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
  }) {
    return _then(_$AlertRuleImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as int,
      projectId: null == projectId
          ? _value.projectId
          : projectId // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      triggerPatterns: null == triggerPatterns
          ? _value._triggerPatterns
          : triggerPatterns // ignore: cast_nullable_to_non_nullable
              as List<String>,
      triggerLevel: freezed == triggerLevel
          ? _value.triggerLevel
          : triggerLevel // ignore: cast_nullable_to_non_nullable
              as LogLevel?,
      channels: null == channels
          ? _value._channels
          : channels // ignore: cast_nullable_to_non_nullable
              as List<String>,
      recipient: null == recipient
          ? _value.recipient
          : recipient // ignore: cast_nullable_to_non_nullable
              as String,
      cooldownMinutes: null == cooldownMinutes
          ? _value.cooldownMinutes
          : cooldownMinutes // ignore: cast_nullable_to_non_nullable
              as int,
      enabled: null == enabled
          ? _value.enabled
          : enabled // ignore: cast_nullable_to_non_nullable
              as bool,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AlertRuleImpl implements _AlertRule {
  const _$AlertRuleImpl(
      {required this.id,
      required this.projectId,
      required this.name,
      final List<String> triggerPatterns = const [],
      this.triggerLevel,
      final List<String> channels = const [],
      required this.recipient,
      this.cooldownMinutes = 15,
      this.enabled = true,
      required this.createdAt,
      this.updatedAt})
      : _triggerPatterns = triggerPatterns,
        _channels = channels;

  factory _$AlertRuleImpl.fromJson(Map<String, dynamic> json) =>
      _$$AlertRuleImplFromJson(json);

  @override
  final int id;
  @override
  final String projectId;
  @override
  final String name;
  final List<String> _triggerPatterns;
  @override
  @JsonKey()
  List<String> get triggerPatterns {
    if (_triggerPatterns is EqualUnmodifiableListView) return _triggerPatterns;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_triggerPatterns);
  }

  @override
  final LogLevel? triggerLevel;
  final List<String> _channels;
  @override
  @JsonKey()
  List<String> get channels {
    if (_channels is EqualUnmodifiableListView) return _channels;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_channels);
  }

  @override
  final String recipient;
  @override
  @JsonKey()
  final int cooldownMinutes;
  @override
  @JsonKey()
  final bool enabled;
  @override
  final DateTime createdAt;
  @override
  final DateTime? updatedAt;

  @override
  String toString() {
    return 'AlertRule(id: $id, projectId: $projectId, name: $name, triggerPatterns: $triggerPatterns, triggerLevel: $triggerLevel, channels: $channels, recipient: $recipient, cooldownMinutes: $cooldownMinutes, enabled: $enabled, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AlertRuleImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.projectId, projectId) ||
                other.projectId == projectId) &&
            (identical(other.name, name) || other.name == name) &&
            const DeepCollectionEquality()
                .equals(other._triggerPatterns, _triggerPatterns) &&
            (identical(other.triggerLevel, triggerLevel) ||
                other.triggerLevel == triggerLevel) &&
            const DeepCollectionEquality().equals(other._channels, _channels) &&
            (identical(other.recipient, recipient) ||
                other.recipient == recipient) &&
            (identical(other.cooldownMinutes, cooldownMinutes) ||
                other.cooldownMinutes == cooldownMinutes) &&
            (identical(other.enabled, enabled) || other.enabled == enabled) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      projectId,
      name,
      const DeepCollectionEquality().hash(_triggerPatterns),
      triggerLevel,
      const DeepCollectionEquality().hash(_channels),
      recipient,
      cooldownMinutes,
      enabled,
      createdAt,
      updatedAt);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$AlertRuleImplCopyWith<_$AlertRuleImpl> get copyWith =>
      __$$AlertRuleImplCopyWithImpl<_$AlertRuleImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AlertRuleImplToJson(
      this,
    );
  }
}

abstract class _AlertRule implements AlertRule {
  const factory _AlertRule(
      {required final int id,
      required final String projectId,
      required final String name,
      final List<String> triggerPatterns,
      final LogLevel? triggerLevel,
      final List<String> channels,
      required final String recipient,
      final int cooldownMinutes,
      final bool enabled,
      required final DateTime createdAt,
      final DateTime? updatedAt}) = _$AlertRuleImpl;

  factory _AlertRule.fromJson(Map<String, dynamic> json) =
      _$AlertRuleImpl.fromJson;

  @override
  int get id;
  @override
  String get projectId;
  @override
  String get name;
  @override
  List<String> get triggerPatterns;
  @override
  LogLevel? get triggerLevel;
  @override
  List<String> get channels;
  @override
  String get recipient;
  @override
  int get cooldownMinutes;
  @override
  bool get enabled;
  @override
  DateTime get createdAt;
  @override
  DateTime? get updatedAt;
  @override
  @JsonKey(ignore: true)
  _$$AlertRuleImplCopyWith<_$AlertRuleImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AlertHistory _$AlertHistoryFromJson(Map<String, dynamic> json) {
  return _AlertHistory.fromJson(json);
}

/// @nodoc
mixin _$AlertHistory {
  int get id => throw _privateConstructorUsedError;
  int get alertRuleId => throw _privateConstructorUsedError;
  int? get logId => throw _privateConstructorUsedError;
  DateTime get sentAt => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String? get errorMessage => throw _privateConstructorUsedError;
  Log? get log => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $AlertHistoryCopyWith<AlertHistory> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AlertHistoryCopyWith<$Res> {
  factory $AlertHistoryCopyWith(
          AlertHistory value, $Res Function(AlertHistory) then) =
      _$AlertHistoryCopyWithImpl<$Res, AlertHistory>;
  @useResult
  $Res call(
      {int id,
      int alertRuleId,
      int? logId,
      DateTime sentAt,
      String status,
      String? errorMessage,
      Log? log});

  $LogCopyWith<$Res>? get log;
}

/// @nodoc
class _$AlertHistoryCopyWithImpl<$Res, $Val extends AlertHistory>
    implements $AlertHistoryCopyWith<$Res> {
  _$AlertHistoryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? alertRuleId = null,
    Object? logId = freezed,
    Object? sentAt = null,
    Object? status = null,
    Object? errorMessage = freezed,
    Object? log = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as int,
      alertRuleId: null == alertRuleId
          ? _value.alertRuleId
          : alertRuleId // ignore: cast_nullable_to_non_nullable
              as int,
      logId: freezed == logId
          ? _value.logId
          : logId // ignore: cast_nullable_to_non_nullable
              as int?,
      sentAt: null == sentAt
          ? _value.sentAt
          : sentAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      errorMessage: freezed == errorMessage
          ? _value.errorMessage
          : errorMessage // ignore: cast_nullable_to_non_nullable
              as String?,
      log: freezed == log
          ? _value.log
          : log // ignore: cast_nullable_to_non_nullable
              as Log?,
    ) as $Val);
  }

  @override
  @pragma('vm:prefer-inline')
  $LogCopyWith<$Res>? get log {
    if (_value.log == null) {
      return null;
    }

    return $LogCopyWith<$Res>(_value.log!, (value) {
      return _then(_value.copyWith(log: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$AlertHistoryImplCopyWith<$Res>
    implements $AlertHistoryCopyWith<$Res> {
  factory _$$AlertHistoryImplCopyWith(
          _$AlertHistoryImpl value, $Res Function(_$AlertHistoryImpl) then) =
      __$$AlertHistoryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {int id,
      int alertRuleId,
      int? logId,
      DateTime sentAt,
      String status,
      String? errorMessage,
      Log? log});

  @override
  $LogCopyWith<$Res>? get log;
}

/// @nodoc
class __$$AlertHistoryImplCopyWithImpl<$Res>
    extends _$AlertHistoryCopyWithImpl<$Res, _$AlertHistoryImpl>
    implements _$$AlertHistoryImplCopyWith<$Res> {
  __$$AlertHistoryImplCopyWithImpl(
      _$AlertHistoryImpl _value, $Res Function(_$AlertHistoryImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? alertRuleId = null,
    Object? logId = freezed,
    Object? sentAt = null,
    Object? status = null,
    Object? errorMessage = freezed,
    Object? log = freezed,
  }) {
    return _then(_$AlertHistoryImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as int,
      alertRuleId: null == alertRuleId
          ? _value.alertRuleId
          : alertRuleId // ignore: cast_nullable_to_non_nullable
              as int,
      logId: freezed == logId
          ? _value.logId
          : logId // ignore: cast_nullable_to_non_nullable
              as int?,
      sentAt: null == sentAt
          ? _value.sentAt
          : sentAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      errorMessage: freezed == errorMessage
          ? _value.errorMessage
          : errorMessage // ignore: cast_nullable_to_non_nullable
              as String?,
      log: freezed == log
          ? _value.log
          : log // ignore: cast_nullable_to_non_nullable
              as Log?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AlertHistoryImpl implements _AlertHistory {
  const _$AlertHistoryImpl(
      {required this.id,
      required this.alertRuleId,
      this.logId,
      required this.sentAt,
      required this.status,
      this.errorMessage,
      this.log});

  factory _$AlertHistoryImpl.fromJson(Map<String, dynamic> json) =>
      _$$AlertHistoryImplFromJson(json);

  @override
  final int id;
  @override
  final int alertRuleId;
  @override
  final int? logId;
  @override
  final DateTime sentAt;
  @override
  final String status;
  @override
  final String? errorMessage;
  @override
  final Log? log;

  @override
  String toString() {
    return 'AlertHistory(id: $id, alertRuleId: $alertRuleId, logId: $logId, sentAt: $sentAt, status: $status, errorMessage: $errorMessage, log: $log)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AlertHistoryImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.alertRuleId, alertRuleId) ||
                other.alertRuleId == alertRuleId) &&
            (identical(other.logId, logId) || other.logId == logId) &&
            (identical(other.sentAt, sentAt) || other.sentAt == sentAt) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.errorMessage, errorMessage) ||
                other.errorMessage == errorMessage) &&
            (identical(other.log, log) || other.log == log));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, alertRuleId, logId, sentAt, status, errorMessage, log);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$AlertHistoryImplCopyWith<_$AlertHistoryImpl> get copyWith =>
      __$$AlertHistoryImplCopyWithImpl<_$AlertHistoryImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AlertHistoryImplToJson(
      this,
    );
  }
}

abstract class _AlertHistory implements AlertHistory {
  const factory _AlertHistory(
      {required final int id,
      required final int alertRuleId,
      final int? logId,
      required final DateTime sentAt,
      required final String status,
      final String? errorMessage,
      final Log? log}) = _$AlertHistoryImpl;

  factory _AlertHistory.fromJson(Map<String, dynamic> json) =
      _$AlertHistoryImpl.fromJson;

  @override
  int get id;
  @override
  int get alertRuleId;
  @override
  int? get logId;
  @override
  DateTime get sentAt;
  @override
  String get status;
  @override
  String? get errorMessage;
  @override
  Log? get log;
  @override
  @JsonKey(ignore: true)
  _$$AlertHistoryImplCopyWith<_$AlertHistoryImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
