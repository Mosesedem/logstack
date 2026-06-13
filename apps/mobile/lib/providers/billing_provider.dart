import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/subscription.dart';
import 'package:logstack_mobile/services/api_client.dart';

final billingProvider =
    StateNotifierProvider<BillingNotifier, BillingState>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return BillingNotifier(apiClient);
});

class BillingState {
  final Subscription? subscription;
  final UsageSummary? usage;
  final bool isLoading;
  final String? error;

  BillingState({
    this.subscription,
    this.usage,
    this.isLoading = false,
    this.error,
  });

  BillingState copyWith({
    Subscription? subscription,
    UsageSummary? usage,
    bool? isLoading,
    String? error,
  }) {
    return BillingState(
      subscription: subscription ?? this.subscription,
      usage: usage ?? this.usage,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class BillingNotifier extends StateNotifier<BillingState> {
  final ApiClient _apiClient;

  BillingNotifier(this._apiClient) : super(BillingState());

  Future<void> loadBillingData() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final results = await Future.wait([
        _apiClient.get<Map<String, dynamic>>('/billing/subscription'),
        _apiClient.get<Map<String, dynamic>>('/billing/usage'),
      ]);

      final subscription = Subscription.fromJson(results[0]);
      final usage = UsageSummary.fromJson(results[1]);

      state = BillingState(
        subscription: subscription,
        usage: usage,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to load billing data: $e',
      );
    }
  }

  void clearError() {
    state = state.copyWith(error: null);
  }
}
