import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/firebase_options.dart';
import 'package:logstack_mobile/models/user.dart';
import 'package:logstack_mobile/services/api_client.dart';
import 'package:logstack_mobile/services/auth_service.dart';
import 'package:logstack_mobile/services/notification_service.dart';
import 'package:logstack_mobile/services/storage_service.dart';

enum PushRegistrationStatus {
  notConfigured,
  awaitingToken,
  notAuthenticated,
  registering,
  registered,
  failed,
}

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
  final String? pushToken;
  final PushRegistrationStatus pushStatus;

  AuthState({
    this.user,
    this.isLoading = false,
    this.error,
    this.pushToken,
    this.pushStatus = PushRegistrationStatus.notConfigured,
  });

  bool get isAuthenticated => user != null;

  AuthState copyWith({
    User? user,
    bool? isLoading,
    String? error,
    String? pushToken,
    PushRegistrationStatus? pushStatus,
  }) {
    return AuthState(
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      pushToken: pushToken ?? this.pushToken,
      pushStatus: pushStatus ?? this.pushStatus,
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
      : super(AuthState(pushStatus: _initialPushStatus())) {
    _checkAuth();
  }

  static PushRegistrationStatus _initialPushStatus() {
    if (!DefaultFirebaseOptions.isConfigured) {
      return PushRegistrationStatus.notConfigured;
    }
    return NotificationService.instance.fcmToken == null
        ? PushRegistrationStatus.awaitingToken
        : PushRegistrationStatus.notAuthenticated;
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
      if (user != null) {
        _listenForFcmToken();
      }
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
    state = AuthState(pushStatus: _initialPushStatus());
  }

  /// Subscribes to the FCM token stream and registers tokens with the backend.
  /// Also registers the already-available token synchronously if present.
  void _listenForFcmToken() {
    _tokenSubscription?.cancel();
    _tokenSubscription =
        NotificationService.instance.tokenStream.listen((token) {
      _currentFcmToken = token;
      state = state.copyWith(
        pushToken: token,
        pushStatus: PushRegistrationStatus.registering,
      );
      _registerPushToken(token);
    });
    final existing = NotificationService.instance.fcmToken;
    if (existing != null) {
      _currentFcmToken = existing;
      state = state.copyWith(
        pushToken: existing,
        pushStatus: PushRegistrationStatus.registering,
      );
      _registerPushToken(existing);
    } else if (!DefaultFirebaseOptions.isConfigured) {
      state = state.copyWith(pushStatus: PushRegistrationStatus.notConfigured);
    } else {
      state = state.copyWith(pushStatus: PushRegistrationStatus.awaitingToken);
    }
  }

  /// Re-attempts backend registration for the current FCM token.
  Future<void> retryPushRegistration() async {
    if (!state.isAuthenticated) {
      state = state.copyWith(
        pushStatus: PushRegistrationStatus.notAuthenticated,
      );
      return;
    }

    final token =
        _currentFcmToken ?? NotificationService.instance.fcmToken;
    if (token == null) {
      state = state.copyWith(pushStatus: PushRegistrationStatus.awaitingToken);
      return;
    }

    _currentFcmToken = token;
    state = state.copyWith(
      pushToken: token,
      pushStatus: PushRegistrationStatus.registering,
    );
    await _registerPushToken(token);
  }

  /// Registers [token] with the backend with up to 3 attempts and
  /// exponential back-off (delays: 1 s, 2 s before retries 2 and 3).
  Future<void> _registerPushToken(String token) async {
    if (!state.isAuthenticated) {
      state = state.copyWith(
        pushToken: token,
        pushStatus: PushRegistrationStatus.notAuthenticated,
      );
      return;
    }

    const maxRetries = 3;
    for (int attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await _apiClient.post<void>('/mobile/push-token', data: {
          'token': token,
          'deviceType': Platform.isIOS ? 'ios' : 'android',
        });
        state = state.copyWith(
          pushToken: token,
          pushStatus: PushRegistrationStatus.registered,
        );
        return;
      } catch (_) {
        if (attempt < maxRetries - 1) {
          // Back-off: 1 s before attempt 2, 2 s before attempt 3
          await Future.delayed(Duration(seconds: 1 << attempt));
        }
      }
    }

    state = state.copyWith(
      pushToken: token,
      pushStatus: PushRegistrationStatus.failed,
    );
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
    _listenForFcmToken();
  }

  /// Exposed for property testing. Calls [_registerPushToken] directly.
  @visibleForTesting
  Future<void> registerPushTokenForTesting(String token) =>
      _registerPushToken(token);
}
