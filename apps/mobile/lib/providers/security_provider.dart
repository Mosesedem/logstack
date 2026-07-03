import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/services/app_lock_service.dart';

/// Tracks whether the signed-in user must configure app PIN before using the shell.
final securityProvider =
    StateNotifierProvider<SecurityNotifier, SecurityState>((ref) {
  final lock = ref.watch(appLockServiceProvider);
  return SecurityNotifier(lock);
});

class SecurityState {
  final bool isLoading;
  final bool needsSetup;

  const SecurityState({
    this.isLoading = true,
    this.needsSetup = false,
  });

  SecurityState copyWith({bool? isLoading, bool? needsSetup}) {
    return SecurityState(
      isLoading: isLoading ?? this.isLoading,
      needsSetup: needsSetup ?? this.needsSetup,
    );
  }
}

class SecurityNotifier extends StateNotifier<SecurityState> {
  SecurityNotifier(this._lock) : super(const SecurityState()) {
    refresh();
  }

  final AppLockService _lock;

  Future<void> refresh() async {
    state = state.copyWith(isLoading: true);
    final mode = await _lock.getLockMode();
    final hasPin = await _lock.hasPin();
    final needsSetup = mode == AppLockMode.immediate && !hasPin;
    state = SecurityState(isLoading: false, needsSetup: needsSetup);
  }

  Future<void> markConfigured() async {
    state = const SecurityState(isLoading: false, needsSetup: false);
  }
}