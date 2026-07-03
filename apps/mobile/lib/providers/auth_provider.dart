import 'dart:async';
import 'dart:io';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/firebase_options.dart';
import 'package:logstack_mobile/models/user.dart';
import 'package:logstack_mobile/services/api_client.dart';
import 'package:logstack_mobile/services/auth_service.dart';
import 'package:logstack_mobile/services/log_cache_service.dart';
import 'package:logstack_mobile/services/notification_service.dart';
import 'package:logstack_mobile/services/storage_service.dart';
import 'package:logstack_mobile/utils/auth_errors.dart';

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
  final cacheService = ref.watch(logCacheServiceProvider);
  return AuthNotifier(authService, storage, apiClient, cacheService);
});

class AuthState {
  final User? user;
  final bool isLoading;
  final bool isOfflineAuth;
  final bool hasPersistedSession;
  final String? error;
  final String? pushToken;
  final PushRegistrationStatus pushStatus;

  AuthState({
    this.user,
    this.isLoading = false,
    this.isOfflineAuth = false,
    this.hasPersistedSession = false,
    this.error,
    this.pushToken,
    this.pushStatus = PushRegistrationStatus.notConfigured,
  });

  bool get isAuthenticated => user != null || hasPersistedSession;

  AuthState copyWith({
    User? user,
    bool? isLoading,
    bool? isOfflineAuth,
    bool? hasPersistedSession,
    String? error,
    String? pushToken,
    PushRegistrationStatus? pushStatus,
    bool clearError = false,
  }) {
    return AuthState(
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      isOfflineAuth: isOfflineAuth ?? this.isOfflineAuth,
      hasPersistedSession: hasPersistedSession ?? this.hasPersistedSession,
      error: clearError ? null : (error ?? this.error),
      pushToken: pushToken ?? this.pushToken,
      pushStatus: pushStatus ?? this.pushStatus,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService;
  final StorageService _storage;
  final ApiClient _apiClient;
  final LogCacheService _cacheService;

  StreamSubscription<String>? _tokenSubscription;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  String? _currentFcmToken;

  AuthNotifier(
    this._authService,
    this._storage,
    this._apiClient,
    this._cacheService,
  ) : super(AuthState(isLoading: true, pushStatus: _initialPushStatus())) {
    _checkAuth();
    _listenConnectivity();
  }

  static PushRegistrationStatus _initialPushStatus() {
    if (!DefaultFirebaseOptions.isConfigured) {
      return PushRegistrationStatus.notConfigured;
    }
    return NotificationService.instance.fcmToken == null
        ? PushRegistrationStatus.awaitingToken
        : PushRegistrationStatus.notAuthenticated;
  }

  void _listenConnectivity() {
    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      final online = !results.contains(ConnectivityResult.none);
      if (online && state.isOfflineAuth) {
        unawaited(refreshSession());
      }
    });
  }

  Future<void> _checkAuth() async {
    state = state.copyWith(isLoading: true);
    try {
      final refreshToken = await _storage.getRefreshToken();
      final cachedUser = await _authService.getCurrentUser();

      if (refreshToken == null && cachedUser == null) {
        state = AuthState(pushStatus: _initialPushStatus());
        return;
      }

      if (refreshToken != null) {
        final refreshed = await _tryRefreshAccessToken(refreshToken);
        if (refreshed == _RefreshResult.revoked) {
          await _storage.clearAll();
          state = AuthState(pushStatus: _initialPushStatus());
          return;
        }
        if (refreshed == _RefreshResult.offline) {
          _setAuthenticatedOffline(cachedUser);
          return;
        }
      }

      User? user = cachedUser;
      if (await _storage.getToken() != null) {
        try {
          user = await _authService.fetchCurrentUser();
        } catch (e) {
          if (isNetworkError(e) && cachedUser != null) {
            _setAuthenticatedOffline(cachedUser);
            return;
          }
        }
      }

      if (user != null) {
        state = AuthState(
          user: user,
          hasPersistedSession: refreshToken != null,
          pushStatus: _initialPushStatus(),
        );
        _listenForFcmToken();
      } else if (refreshToken != null) {
        _setAuthenticatedOffline(cachedUser);
      } else {
        state = AuthState(pushStatus: _initialPushStatus());
      }
    } catch (e) {
      final cachedUser = await _authService.getCurrentUser();
      final refreshToken = await _storage.getRefreshToken();
      if (cachedUser != null && refreshToken != null) {
        _setAuthenticatedOffline(cachedUser);
      } else {
        state = AuthState(pushStatus: _initialPushStatus());
      }
    }
  }

  void _setAuthenticatedOffline(User? user) {
    state = AuthState(
      user: user,
      isOfflineAuth: true,
      hasPersistedSession: true,
      pushStatus: _initialPushStatus(),
    );
    _listenForFcmToken();
  }

  Future<_RefreshResult> _tryRefreshAccessToken(String refreshToken) async {
    try {
      final accessToken =
          await _authService.refreshMobileAccessToken(refreshToken);
      await _storage.setToken(accessToken);
      return _RefreshResult.success;
    } catch (e) {
      if (isRevokedAuthError(e)) return _RefreshResult.revoked;
      if (isNetworkError(e)) return _RefreshResult.offline;
    }

    try {
      final accessToken = await _authService.refreshAccessToken(refreshToken);
      await _storage.setToken(accessToken);
      return _RefreshResult.success;
    } catch (e) {
      if (isRevokedAuthError(e)) return _RefreshResult.revoked;
      if (isNetworkError(e)) return _RefreshResult.offline;
    }

    return _RefreshResult.offline;
  }

  /// Re-validates the session when connectivity returns.
  Future<void> refreshSession() async {
    if (!state.isAuthenticated && !state.isOfflineAuth) return;

    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken == null) return;

    final refreshed = await _tryRefreshAccessToken(refreshToken);
    if (refreshed == _RefreshResult.revoked) {
      await logout();
      return;
    }
    if (refreshed == _RefreshResult.offline) return;

    try {
      final user = await _authService.fetchCurrentUser();
      state = state.copyWith(user: user, isOfflineAuth: false, clearError: true);
      _listenForFcmToken();
    } catch (e) {
      if (!isNetworkError(e)) {
        state = state.copyWith(error: e.toString());
      }
    }
  }

  Future<void> loginWithEmail(String email, String password) async {
    final response = await _authService.login(
      email: email,
      password: password,
    );
    state = AuthState(user: response.user, hasPersistedSession: true);
    _listenForFcmToken();
  }

  Future<void> logout() async {
    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken != null) {
      await _authService.revokeRefreshToken(refreshToken);
    }

    if (_currentFcmToken != null) {
      try {
        await _apiClient.delete(
          '/mobile/push-token?token=${Uri.encodeComponent(_currentFcmToken!)}',
        );
      } catch (_) {}
    }
    _tokenSubscription?.cancel();
    _tokenSubscription = null;
    _currentFcmToken = null;
    await _cacheService.clearAll();
    await _authService.logout();
    state = AuthState(pushStatus: _initialPushStatus());
  }

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

  Future<void> retryPushRegistration() async {
    if (!state.isAuthenticated) {
      state = state.copyWith(
        pushStatus: PushRegistrationStatus.notAuthenticated,
      );
      return;
    }

    final token = _currentFcmToken ?? NotificationService.instance.fcmToken;
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

  Future<void> _registerPushToken(String token) async {
    if (!state.isAuthenticated) {
      state = state.copyWith(
        pushToken: token,
        pushStatus: PushRegistrationStatus.notAuthenticated,
      );
      return;
    }

    if (state.isOfflineAuth) {
      state = state.copyWith(
        pushToken: token,
        pushStatus: PushRegistrationStatus.failed,
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
      } catch (e) {
        if (isNetworkError(e)) {
          state = state.copyWith(
            pushToken: token,
            pushStatus: PushRegistrationStatus.failed,
          );
          return;
        }
        if (attempt < maxRetries - 1) {
          await Future.delayed(Duration(seconds: 1 << attempt));
        }
      }
    }

    state = state.copyWith(
      pushToken: token,
      pushStatus: PushRegistrationStatus.failed,
    );
  }

  Future<void> setTokensFromPair(TokenPair pair) async {
    await _storage.setToken(pair.accessToken);
    await _storage.setRefreshToken(pair.refreshToken);
    User? user;
    try {
      user = await _authService.fetchCurrentUser();
    } catch (_) {
      user = await _authService.getCurrentUser();
    }
    state = AuthState(user: user, hasPersistedSession: true);
    _listenForFcmToken();
  }

  @visibleForTesting
  Future<void> registerPushTokenForTesting(String token) =>
      _registerPushToken(token);

  @override
  void dispose() {
    _tokenSubscription?.cancel();
    _connectivitySub?.cancel();
    super.dispose();
  }
}

enum _RefreshResult { success, revoked, offline }