// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'subscription.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Subscription _$SubscriptionFromJson(Map<String, dynamic> json) => Subscription(
      id: json['id'] as int,
      userId: json['userId'] as int,
      tier: $enumDecode(_$SubscriptionTierEnumMap, json['tier']),
      status: $enumDecode(_$SubscriptionStatusEnumMap, json['status']),
      currency: json['currency'] as String,
      amountCents: json['amountCents'] as int,
      periodStart: json['periodStart'] == null
          ? null
          : DateTime.parse(json['periodStart'] as String),
      periodEnd: json['periodEnd'] == null
          ? null
          : DateTime.parse(json['periodEnd'] as String),
      logLimit: json['logLimit'] as int,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$SubscriptionToJson(Subscription instance) =>
    <String, dynamic>{
      'id': instance.id,
      'userId': instance.userId,
      'tier': _$SubscriptionTierEnumMap[instance.tier]!,
      'status': _$SubscriptionStatusEnumMap[instance.status]!,
      'currency': instance.currency,
      'amountCents': instance.amountCents,
      'periodStart': instance.periodStart?.toIso8601String(),
      'periodEnd': instance.periodEnd?.toIso8601String(),
      'logLimit': instance.logLimit,
      'createdAt': instance.createdAt.toIso8601String(),
    };

const _$SubscriptionTierEnumMap = {
  SubscriptionTier.free: 'free',
  SubscriptionTier.starter: 'starter',
  SubscriptionTier.pro: 'pro',
  SubscriptionTier.enterprise: 'enterprise',
};

const _$SubscriptionStatusEnumMap = {
  SubscriptionStatus.active: 'active',
  SubscriptionStatus.cancelled: 'cancelled',
  SubscriptionStatus.pastDue: 'past_due',
  SubscriptionStatus.trialing: 'trialing',
  SubscriptionStatus.paused: 'paused',
};

T $enumDecode<T>(Map<T, dynamic> map, dynamic value) {
  return map.entries.firstWhere((e) => e.value == value).key;
}

UsageSummary _$UsageSummaryFromJson(Map<String, dynamic> json) => UsageSummary(
      userId: json['userId'] as int,
      month: json['month'] as String,
      totalLogCount: json['totalLogCount'] as int,
      totalBytesIngested: json['totalBytesIngested'] as int,
      activeProjects: json['activeProjects'] as int,
      tier: $enumDecode(_$SubscriptionTierEnumMap, json['tier']),
      logLimit: json['logLimit'] as int,
      usagePercentage: (json['usagePercentage'] as num).toDouble(),
      isOverLimit: json['isOverLimit'] as bool,
    );

Map<String, dynamic> _$UsageSummaryToJson(UsageSummary instance) =>
    <String, dynamic>{
      'userId': instance.userId,
      'month': instance.month,
      'totalLogCount': instance.totalLogCount,
      'totalBytesIngested': instance.totalBytesIngested,
      'activeProjects': instance.activeProjects,
      'tier': _$SubscriptionTierEnumMap[instance.tier]!,
      'logLimit': instance.logLimit,
      'usagePercentage': instance.usagePercentage,
      'isOverLimit': instance.isOverLimit,
    };
