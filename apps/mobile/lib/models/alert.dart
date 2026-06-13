import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:logstack_mobile/models/log.dart';

part 'alert.freezed.dart';
part 'alert.g.dart';

@freezed
class AlertRule with _$AlertRule {
  const factory AlertRule({
    required String id,
    required String projectId,
    required String name,
    required LogLevel level,
    required int threshold,
    required int window,
    required int cooldown,
    required bool emailEnabled,
    required bool pushEnabled,
    required bool enabled,
    required DateTime createdAt,
  }) = _AlertRule;

  factory AlertRule.fromJson(Map<String, dynamic> json) =>
      _$AlertRuleFromJson(json);
}

@freezed
class AlertHistory with _$AlertHistory {
  const factory AlertHistory({
    required String id,
    required String ruleId,
    required String ruleName,
    required LogLevel level,
    required String message,
    required int logCount,
    required DateTime triggeredAt,
  }) = _AlertHistory;

  factory AlertHistory.fromJson(Map<String, dynamic> json) =>
      _$AlertHistoryFromJson(json);
}
