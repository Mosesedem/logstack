import 'package:json_annotation/json_annotation.dart';

part 'subscription.g.dart';

enum SubscriptionTier {
  @JsonValue('free')
  free,
  @JsonValue('starter')
  starter,
  @JsonValue('pro')
  pro,
  @JsonValue('enterprise')
  enterprise,
}

enum SubscriptionStatus {
  @JsonValue('active')
  active,
  @JsonValue('cancelled')
  cancelled,
  @JsonValue('past_due')
  pastDue,
  @JsonValue('trialing')
  trialing,
  @JsonValue('paused')
  paused,
}

@JsonSerializable()
class Subscription {
  final int id;
  final int userId;
  final SubscriptionTier tier;
  final SubscriptionStatus status;
  final String currency;
  final int amountCents;
  final DateTime? periodStart;
  final DateTime? periodEnd;
  final int logLimit;
  final DateTime createdAt;

  Subscription({
    required this.id,
    required this.userId,
    required this.tier,
    required this.status,
    required this.currency,
    required this.amountCents,
    this.periodStart,
    this.periodEnd,
    required this.logLimit,
    required this.createdAt,
  });

  factory Subscription.fromJson(Map<String, dynamic> json) =>
      _$SubscriptionFromJson(json);

  Map<String, dynamic> toJson() => _$SubscriptionToJson(this);

  String get tierName {
    switch (tier) {
      case SubscriptionTier.free:
        return 'Free';
      case SubscriptionTier.starter:
        return 'Starter';
      case SubscriptionTier.pro:
        return 'Pro';
      case SubscriptionTier.enterprise:
        return 'Enterprise';
    }
  }

  bool get isActive =>
      status == SubscriptionStatus.active ||
      status == SubscriptionStatus.trialing;
}

@JsonSerializable()
class UsageSummary {
  final int userId;
  final String month;
  final int totalLogCount;
  final int totalBytesIngested;
  final int activeProjects;
  final SubscriptionTier tier;
  final int logLimit;
  final double usagePercentage;
  final bool isOverLimit;

  UsageSummary({
    required this.userId,
    required this.month,
    required this.totalLogCount,
    required this.totalBytesIngested,
    required this.activeProjects,
    required this.tier,
    required this.logLimit,
    required this.usagePercentage,
    required this.isOverLimit,
  });

  factory UsageSummary.fromJson(Map<String, dynamic> json) =>
      _$UsageSummaryFromJson(json);

  Map<String, dynamic> toJson() => _$UsageSummaryToJson(this);

  String get formattedLogCount {
    if (totalLogCount >= 1000000) {
      return '${(totalLogCount / 1000000).toStringAsFixed(1)}M';
    } else if (totalLogCount >= 1000) {
      return '${(totalLogCount / 1000).toStringAsFixed(1)}K';
    }
    return totalLogCount.toString();
  }

  String get formattedLogLimit {
    if (logLimit < 0) return 'Unlimited';
    if (logLimit >= 1000000) {
      return '${(logLimit / 1000000).toStringAsFixed(0)}M';
    } else if (logLimit >= 1000) {
      return '${(logLimit / 1000).toStringAsFixed(0)}K';
    }
    return logLimit.toString();
  }
}
