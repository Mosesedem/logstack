import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/user.dart';
import 'package:logstack_mobile/services/api_client.dart';
import 'package:logstack_mobile/services/auth_service.dart';
import 'package:logstack_mobile/services/notification_service.dart';
import 'package:logstack_mobile/services/storage_service.dart';

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final authService = ref.watch(authServiceProvider);
  final storage = ref.watch(storageServiceProvider);
  final apiClient = ref.watch(apiClientProvider);
  return AuthNotifier(authService, storage, apiClient);
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
  final ApiClient _apiClient;

  StreamSubscription<String>? _tokenSubscription;
  String? _currentFcmToken;

  AuthNotifier(this._authService, this._storage, this._apiClient)
      : super(AuthState()) {
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    state = state.copyWith(isLoading: true);
    try {
      // Attempt silent refresh if a refresh token is stored.
      final refreshToken = await _storage.getRefreshToken();
      if (refreshToken != null) {
        try {
          final newAccessToken =
              await _authService.refreshAccessToken(refreshToken);
          await _storage.setToken(newAccessToken);
        } catch (_) {
          // Refresh token is expired / revoked — clear everything and go to
          // login by leaving state as unauthenticated.
          await _storage.clearAll();
          state = AuthState();
          return;
        }
      }

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
      _listenForFcmToken();
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      rethrow;
    }
  }

  Future<void> logout() async {
    // Best-effort revocation of the refresh token before clearing local state.
    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken != null) {
      await _authService.revokeRefreshToken(refreshToken);
    }

    // Best-effort deregistration of the current FCM token
    if (_currentFcmToken != null) {
      try {
        await _apiClient.delete(
            '/mobile/push-token?token=${Uri.encodeComponent(_currentFcmToken!)}');
      } catch (_) {}
    }
    _tokenSubscription?.cancel();
    _tokenSubscription = null;
    _currentFcmToken = null;
    await _authService.logout();
    state = AuthState();
  }

  /// Subscribes to the FCM token stream and registers tokens with the backend.
  /// Also registers the already-available token synchronously if present.
  void _listenForFcmToken() {
    _tokenSubscription?.cancel();
    _tokenSubscription =
        NotificationService.instance.tokenStream.listen((token) {
      _currentFcmToken = token;
      _registerPushToken(token);
    });
    final existing = NotificationService.instance.fcmToken;
    if (existing != null) {
      _currentFcmToken = existing;
      _registerPushToken(existing);
    }
  }

  /// Registers [token] with the backend with up to 3 attempts and
  /// exponential back-off (delays: 1 s, 2 s before retries 2 and 3).
  Future<void> _registerPushToken(String token) async {
    const maxRetries = 3;
    for (int attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await _apiClient.post<void>('/mobile/push-token', data: {
          'token': token,
          'deviceType': Platform.isIOS ? 'ios' : 'android',
        });
        return; // success
      } catch (_) {
        if (attempt < maxRetries - 1) {
          // Back-off: 1 s before attempt 2, 2 s before attempt 3
          await Future.delayed(Duration(seconds: 1 << attempt));
        }
        // After the last attempt, silently give up
      }
    }
  }

  /// Stores a [TokenPair] received from QR login and updates auth state.
  ///
  /// Persists the access token and refresh token via [StorageService] and
  /// reloads the current user from local storage so the UI reflects the
  /// authenticated state.
  Future<void> setTokensFromPair(TokenPair pair) async {
    await _storage.setToken(pair.accessToken);
    await _storage.setRefreshToken(pair.refreshToken);
    // Attempt to load user profile from storage (populated if QR confirm
    // response also returns user data). Fall back to a minimal reload.
    final user = await _authService.getCurrentUser();
    state = AuthState(user: user);
  }

  /// Exposed for property testing. Calls [_registerPushToken] directly.
  @visibleForTesting
  Future<void> registerPushTokenForTesting(String token) =>
      _registerPushToken(token);
}
