import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/services/storage_service.dart';

final onboardingProvider =
    StateNotifierProvider<OnboardingNotifier, OnboardingState>((ref) {
  final storage = ref.watch(storageServiceProvider);
  return OnboardingNotifier(storage);
});

class OnboardingState {
  final bool isLoading;
  final bool isComplete;

  const OnboardingState({
    this.isLoading = true,
    this.isComplete = false,
  });

  OnboardingState copyWith({bool? isLoading, bool? isComplete}) {
    return OnboardingState(
      isLoading: isLoading ?? this.isLoading,
      isComplete: isComplete ?? this.isComplete,
    );
  }
}

class OnboardingNotifier extends StateNotifier<OnboardingState> {
  OnboardingNotifier(this._storage) : super(const OnboardingState()) {
    _load();
  }

  final StorageService _storage;

  Future<void> _load() async {
    final complete = await _storage.isOnboardingComplete();
    state = OnboardingState(isLoading: false, isComplete: complete);
  }

  Future<void> markComplete() async {
    await _storage.setOnboardingComplete(true);
    state = state.copyWith(isComplete: true);
  }

  Future<void> refresh() => _load();
}