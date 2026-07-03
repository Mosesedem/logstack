import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/services/storage_service.dart';

/// Post-login security gate — PIN/biometrics only after the user signs in.
final securityProvider =
    StateNotifierProvider<SecurityNotifier, SecurityState>((ref) {
  final storage = ref.watch(storageServiceProvider);
  return SecurityNotifier(storage);
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
  SecurityNotifier(this._storage) : super(const SecurityState());

  final StorageService _storage;

  Future<void> refresh({required bool isAuthenticated}) async {
    state = state.copyWith(isLoading: true);
    if (!isAuthenticated) {
      state = const SecurityState(isLoading: false, needsSetup: false);
      return;
    }
    final complete = await _storage.isSessionSecurityComplete();
    state = SecurityState(isLoading: false, needsSetup: !complete);
  }

  Future<void> markConfigured() async {
    await _storage.setSessionSecurityComplete(true);
    state = const SecurityState(isLoading: false, needsSetup: false);
  }

  Future<void> resetForNewLogin() async {
    await _storage.setSessionSecurityComplete(false);
    state = const SecurityState(isLoading: false, needsSetup: true);
  }
}