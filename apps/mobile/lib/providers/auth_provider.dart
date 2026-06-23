import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/user.dart';
import 'package:logstack_mobile/services/auth_service.dart';
import 'package:logstack_mobile/services/storage_service.dart';

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final authService = ref.watch(authServiceProvider);
  final storage = ref.watch(storageServiceProvider);
  return AuthNotifier(authService, storage);
});

class AuthState {
  final User? user;
  final bool isLoading;
  final String? error;

  AuthState({
    this.user,
    this.isLoading = false,
    this.error,
  });

  bool get isAuthenticated => user != null;

  AuthState copyWith({
    User? user,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService;
  final StorageService _storage;

  AuthNotifier(this._authService, this._storage) : super(AuthState()) {
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    state = state.copyWith(isLoading: true);
    try {
      final user = await _authService.getCurrentUser();
      state = AuthState(user: user);
    } catch (e) {
      state = AuthState();
    }
  }

  Future<void> login({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _authService.login(
        email: email,
        password: password,
      );
      state = AuthState(user: response.user);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      rethrow;
    }
  }

  Future<void> signup({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _authService.signup(
        email: email,
        password: password,
      );
      state = AuthState(user: response.user);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      rethrow;
    }
  }

  Future<void> logout() async {
    await _authService.logout();
    state = AuthState();
  }

  /// Stores a [TokenPair] received from QR login and updates auth state.
  ///
  /// Persists the access token via [StorageService] and reloads the current
  /// user from local storage so the UI reflects the authenticated state.
  Future<void> setTokensFromPair(TokenPair pair) async {
    await _storage.setToken(pair.accessToken);
    // Attempt to load user profile from storage (populated if QR confirm
    // response also returns user data). Fall back to a minimal reload.
    final user = await _authService.getCurrentUser();
    state = AuthState(user: user);
  }
}
