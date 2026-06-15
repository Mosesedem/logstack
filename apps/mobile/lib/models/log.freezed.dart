// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'log.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

Log _$LogFromJson(Map<String, dynamic> json) {
  return _Log.fromJson(json);
}

/// @nodoc
mixin _$Log {
  String get id => throw _privateConstructorUsedError;
  String get projectId => throw _privateConstructorUsedError;
  LogLevel get level => throw _privateConstructorUsedError;
  String get message => throw _privateConstructorUsedError;
  String? get source => throw _privateConstructorUsedError;
  Map<String, dynamic>? get metadata => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $LogCopyWith<Log> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $LogCopyWith<$Res> {
  factory $LogCopyWith(Log value, $Res Function(Log) then) =
      _$LogCopyWithImpl<$Res, Log>;
  @useResult
  $Res call(
      {String id,
      String projectId,
      LogLevel level,
      String message,
      String? source,
      Map<String, dynamic>? metadata,
      DateTime createdAt});
}

/// @nodoc
class _$LogCopyWithImpl<$Res, $Val extends Log> implements $LogCopyWith<$Res> {
  _$LogCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? projectId = null,
    Object? level = null,
    Object? message = null,
    Object? source = freezed,
    Object? metadata = freezed,
    Object? createdAt = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      projectId: null == projectId
          ? _value.projectId
          : projectId // ignore: cast_nullable_to_non_nullable
              as String,
      level: null == level
          ? _value.level
          : level // ignore: cast_nullable_to_non_nullable
              as LogLevel,
      message: null == message
          ? _value.message
          : message // ignore: cast_nullable_to_non_nullable
              as String,
      source: freezed == source
          ? _value.source
          : source // ignore: cast_nullable_to_non_nullable
              as String?,
      metadata: freezed == metadata
          ? _value.metadata
          : metadata // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$LogImplCopyWith<$Res> implements $LogCopyWith<$Res> {
  factory _$$LogImplCopyWith(_$LogImpl value, $Res Function(_$LogImpl) then) =
      __$$LogImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String projectId,
      LogLevel level,
      String message,
      String? source,
      Map<String, dynamic>? metadata,
      DateTime createdAt});
}

/// @nodoc
class __$$LogImplCopyWithImpl<$Res> extends _$LogCopyWithImpl<$Res, _$LogImpl>
    implements _$$LogImplCopyWith<$Res> {
  __$$LogImplCopyWithImpl(_$LogImpl _value, $Res Function(_$LogImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? projectId = null,
    Object? level = null,
    Object? message = null,
    Object? source = freezed,
    Object? metadata = freezed,
    Object? createdAt = null,
  }) {
    return _then(_$LogImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      projectId: null == projectId
          ? _value.projectId
          : projectId // ignore: cast_nullable_to_non_nullable
              as String,
      level: null == level
          ? _value.level
          : level // ignore: cast_nullable_to_non_nullable
              as LogLevel,
      message: null == message
          ? _value.message
          : message // ignore: cast_nullable_to_non_nullable
              as String,
      source: freezed == source
          ? _value.source
          : source // ignore: cast_nullable_to_non_nullable
              as String?,
      metadata: freezed == metadata
          ? _value._metadata
          : metadata // ignore: cast_nullable_to_non_nullable
              as Map<String, dynamic>?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$LogImpl implements _Log {
  const _$LogImpl(
      {required this.id,
      required this.projectId,
      required this.level,
      required this.message,
      this.source,
      final Map<String, dynamic>? metadata,
      required this.createdAt})
      : _metadata = metadata;

  factory _$LogImpl.fromJson(Map<String, dynamic> json) =>
      _$$LogImplFromJson(json);

  @override
  final String id;
  @override
  final String projectId;
  @override
  final LogLevel level;
  @override
  final String message;
  @override
  final String? source;
  final Map<String, dynamic>? _metadata;
  @override
  Map<String, dynamic>? get metadata {
    final value = _metadata;
    if (value == null) return null;
    if (_metadata is EqualUnmodifiableMapView) return _metadata;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  @override
  final DateTime createdAt;

  @override
  String toString() {
    return 'Log(id: $id, projectId: $projectId, level: $level, message: $message, source: $source, metadata: $metadata, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$LogImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.projectId, projectId) ||
                other.projectId == projectId) &&
            (identical(other.level, level) || other.level == level) &&
            (identical(other.message, message) || other.message == message) &&
            (identical(other.source, source) || other.source == source) &&
            const DeepCollectionEquality().equals(other._metadata, _metadata) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(runtimeType, id, projectId, level, message,
      source, const DeepCollectionEquality().hash(_metadata), createdAt);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$LogImplCopyWith<_$LogImpl> get copyWith =>
      __$$LogImplCopyWithImpl<_$LogImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$LogImplToJson(
      this,
    );
  }
}

abstract class _Log implements Log {
  const factory _Log(
      {required final String id,
      required final String projectId,
      required final LogLevel level,
      required final String message,
      final String? source,
      final Map<String, dynamic>? metadata,
      required final DateTime createdAt}) = _$LogImpl;

  factory _Log.fromJson(Map<String, dynamic> json) = _$LogImpl.fromJson;

  @override
  String get id;
  @override
  String get projectId;
  @override
  LogLevel get level;
  @override
  String get message;
  @override
  String? get source;
  @override
  Map<String, dynamic>? get metadata;
  @override
  DateTime get createdAt;
  @override
  @JsonKey(ignore: true)
  _$$LogImplCopyWith<_$LogImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

LogsResponse _$LogsResponseFromJson(Map<String, dynamic> json) {
  return _LogsResponse.fromJson(json);
}

/// @nodoc
mixin _$LogsResponse {
  List<Log> get logs => throw _privateConstructorUsedError;
  bool get hasMore => throw _privateConstructorUsedError;
  int get offset => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $LogsResponseCopyWith<LogsResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $LogsResponseCopyWith<$Res> {
  factory $LogsResponseCopyWith(
          LogsResponse value, $Res Function(LogsResponse) then) =
      _$LogsResponseCopyWithImpl<$Res, LogsResponse>;
  @useResult
  $Res call({List<Log> logs, bool hasMore, int offset});
}

/// @nodoc
class _$LogsResponseCopyWithImpl<$Res, $Val extends LogsResponse>
    implements $LogsResponseCopyWith<$Res> {
  _$LogsResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? logs = null,
    Object? hasMore = null,
    Object? offset = null,
  }) {
    return _then(_value.copyWith(
      logs: null == logs
          ? _value.logs
          : logs // ignore: cast_nullable_to_non_nullable
              as List<Log>,
      hasMore: null == hasMore
          ? _value.hasMore
          : hasMore // ignore: cast_nullable_to_non_nullable
              as bool,
      offset: null == offset
          ? _value.offset
          : offset // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$LogsResponseImplCopyWith<$Res>
    implements $LogsResponseCopyWith<$Res> {
  factory _$$LogsResponseImplCopyWith(
          _$LogsResponseImpl value, $Res Function(_$LogsResponseImpl) then) =
      __$$LogsResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<Log> logs, bool hasMore, int offset});
}

/// @nodoc
class __$$LogsResponseImplCopyWithImpl<$Res>
    extends _$LogsResponseCopyWithImpl<$Res, _$LogsResponseImpl>
    implements _$$LogsResponseImplCopyWith<$Res> {
  __$$LogsResponseImplCopyWithImpl(
      _$LogsResponseImpl _value, $Res Function(_$LogsResponseImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? logs = null,
    Object? hasMore = null,
    Object? offset = null,
  }) {
    return _then(_$LogsResponseImpl(
      logs: null == logs
          ? _value._logs
          : logs // ignore: cast_nullable_to_non_nullable
              as List<Log>,
      hasMore: null == hasMore
          ? _value.hasMore
          : hasMore // ignore: cast_nullable_to_non_nullable
              as bool,
      offset: null == offset
          ? _value.offset
          : offset // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$LogsResponseImpl implements _LogsResponse {
  const _$LogsResponseImpl(
      {required final List<Log> logs,
      required this.hasMore,
      required this.offset})
      : _logs = logs;

  factory _$LogsResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$LogsResponseImplFromJson(json);

  final List<Log> _logs;
  @override
  List<Log> get logs {
    if (_logs is EqualUnmodifiableListView) return _logs;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_logs);
  }

  @override
  final bool hasMore;
  @override
  final int offset;

  @override
  String toString() {
    return 'LogsResponse(logs: $logs, hasMore: $hasMore, offset: $offset)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$LogsResponseImpl &&
            const DeepCollectionEquality().equals(other._logs, _logs) &&
            (identical(other.hasMore, hasMore) || other.hasMore == hasMore) &&
            (identical(other.offset, offset) || other.offset == offset));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(
      runtimeType, const DeepCollectionEquality().hash(_logs), hasMore, offset);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$LogsResponseImplCopyWith<_$LogsResponseImpl> get copyWith =>
      __$$LogsResponseImplCopyWithImpl<_$LogsResponseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$LogsResponseImplToJson(
      this,
    );
  }
}

abstract class _LogsResponse implements LogsResponse {
  const factory _LogsResponse(
      {required final List<Log> logs,
      required final bool hasMore,
      required final int offset}) = _$LogsResponseImpl;

  factory _LogsResponse.fromJson(Map<String, dynamic> json) =
      _$LogsResponseImpl.fromJson;

  @override
  List<Log> get logs;
  @override
  bool get hasMore;
  @override
  int get offset;
  @override
  @JsonKey(ignore: true)
  _$$LogsResponseImplCopyWith<_$LogsResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
