import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:logstack_mobile/models/log.dart';

part 'alert.freezed.dart';
part 'alert.g.dart';

@freezed
class AlertRule with _$AlertRule {
  const factory AlertRule({
    required int id,
    required String projectId,
    required String name,
    @Default([]) List<String> triggerPatterns,
    LogLevel? triggerLevel,
    @Default([]) List<String> channels,
    required String recipient,
    @Default(15) int cooldownMinutes,
    @Default(true) bool enabled,
    required DateTime createdAt,
    DateTime? updatedAt,
  }) = _AlertRule;

  factory AlertRule.fromJson(Map<String, dynamic> json) =>
      _$AlertRuleFromJson(json);
}

@freezed
class AlertHistory with _$AlertHistory {
  const factory AlertHistory({
    required int id,
    required int alertRuleId,
    int? logId,
    required DateTime sentAt,
    required String status,
    String? errorMessage,
    Log? log,
  }) = _AlertHistory;

  factory AlertHistory.fromJson(Map<String, dynamic> json) =>
      _$AlertHistoryFromJson(json);
}