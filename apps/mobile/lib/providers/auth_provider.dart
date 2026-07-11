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
import 'package:logstack_mobile/providers/security_provider.dart';
import 'package:logstack_mobile/services/app_lock_service.dart';
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
  final appLock = ref.watch(appLockServiceProvider);
  return AuthNotifier(
    authService,
    storage,
    apiClient,
    cacheService,
    appLock,
    () => ref.read(securityProvider.notifier).resetForNewLogin(),
  );
});

class AuthState {
  final User? user;
  final bool isLoading;
  final bool isOfflineAuth;
  final bool hasPersistedSession;
  final String? error;
  final String? pushToken;
  final String? backendMaskedToken;
  final PushRegistrationStatus pushStatus;

  AuthState({
    this.user,
    this.isLoading = false,
    this.isOfflineAuth = false,
    this.hasPersistedSession = false,
    this.error,
    this.pushToken,
    this.backendMaskedToken,
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
    String? backendMaskedToken,
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
      backendMaskedToken: backendMaskedToken ?? this.backendMaskedToken,
      pushStatus: pushStatus ?? this.pushStatus,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService;
  final StorageService _storage;
  final ApiClient _apiClient;
  final LogCacheService _cacheService;
  final AppLockService _appLock;
  final Future<void> Function() _onSecurityChanged;

  StreamSubscription<String>? _tokenSubscription;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  String? _currentFcmToken;
  /// User id the FCM token was last successfully registered for (multi-account).
  int? _pushBoundUserId;

  AuthNotifier(
    this._authService,
    this._storage,
    this._apiClient,
    this._cacheService,
    this._appLock,
    this._onSecurityChanged,
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
          _tokenSubscription?.cancel();
          _tokenSubscription = null;
          _currentFcmToken = null;
          _pushBoundUserId = null;
          await _appLock.clearPin();
          await _appLock.setBiometricEnabled(false);
          await _storage.clearSession();
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
        unawaited(_setupPushIfPermitted());
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
    unawaited(_setupPushIfPermitted());
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
      unawaited(_setupPushIfPermitted());
    } catch (e) {
      if (!isNetworkError(e)) {
        state = state.copyWith(error: e.toString());
      }
    }
  }

  Future<void> loginWithEmail(String email, String password) async {
    // Drop any prior session binding before attaching the new account.
    _tokenSubscription?.cancel();
    _tokenSubscription = null;
    _currentFcmToken = null;
    _pushBoundUserId = null;

    final response = await _authService.login(
      email: email,
      password: password,
    );
    await _onSecurityChanged();
    state = AuthState(user: response.user, hasPersistedSession: true);
    // Always re-bind this device's FCM token to the new user_id.
    unawaited(_setupPushIfPermitted());
  }

  Future<void> logout() async {
    // Unbind this account's push while the JWT is still valid so the previous
    // user stops receiving alerts. The FCM device token itself stays (same app
    // install); the next login re-registers it for the new user_id.
    final fcmToken =
        _currentFcmToken ?? NotificationService.instance.fcmToken;
    if (fcmToken != null) {
      try {
        await _apiClient.delete(
          '/mobile/push-token?token=${Uri.encodeComponent(fcmToken)}',
        );
      } catch (_) {
        // Offline or already signed out server-side — next register reassigns.
      }
    }

    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken != null) {
      await _authService.revokeRefreshToken(refreshToken);
    }

    _tokenSubscription?.cancel();
    _tokenSubscription = null;
    // Keep device FCM token in NotificationService; clear only our session
    // registration pointer so the next account always re-POSTs the token.
    _currentFcmToken = null;
    _pushBoundUserId = null;

    await _cacheService.clearAll();
    await _appLock.clearPin();
    await _appLock.setBiometricEnabled(false);
    await _authService.logout(); // clearSession: tokens, user, project id

    state = AuthState(pushStatus: _initialPushStatus());
  }

  /// Registers for push only when the user has already granted OS permission.
  /// Permission is requested from Settings via [enablePushNotifications].
  Future<void> _setupPushIfPermitted() async {
    _tokenSubscription?.cancel();

    if (!DefaultFirebaseOptions.isConfigured) {
      state = state.copyWith(pushStatus: PushRegistrationStatus.notConfigured);
      return;
    }

    if (!await NotificationService.instance.hasPushPermission()) {
      state = state.copyWith(pushStatus: PushRegistrationStatus.awaitingToken);
      return;
    }

    await NotificationService.instance.completeSetupAfterPermission();

    if (Platform.isIOS) {
      for (var attempt = 0; attempt < 8; attempt++) {
        final token = await NotificationService.instance.fetchFCMToken();
        if (token != null) break;
        await Future<void>.delayed(
          Duration(milliseconds: 400 * (attempt + 1)),
        );
      }
    }

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
    } else {
      state = state.copyWith(pushStatus: PushRegistrationStatus.awaitingToken);
    }
  }

  /// Registers the device token after the user granted OS permission on the
  /// push setup screen. Does not show the system permission dialog.
  Future<void> registerPushAfterPermission() async {
    if (!state.isAuthenticated) return;
    await _setupPushIfPermitted();
  }

  Future<void> retryPushRegistration() async {
    if (!state.isAuthenticated) {
      state = state.copyWith(
        pushStatus: PushRegistrationStatus.notAuthenticated,
      );
      return;
    }

    state = state.copyWith(pushStatus: PushRegistrationStatus.registering);

    String? token = _currentFcmToken ?? NotificationService.instance.fcmToken;
    if (Platform.isIOS) {
      token = await NotificationService.instance.refreshFCMToken() ?? token;
    }
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

  /// Re-syncs the device FCM token with the API after app resume (iOS tokens rotate).
  /// Sends a test push via the API to this user's registered tokens.
  Future<Map<String, dynamic>> sendApiPushTest() async {
    if (!state.isAuthenticated || state.isOfflineAuth) {
      throw StateError('Sign in and go online to test API push');
    }
    final token = await NotificationService.instance.fetchFCMToken();
    if (token != null) {
      await _registerPushToken(token);
    }
    final response = await _apiClient.post<Map<String, dynamic>>(
      '/mobile/push-test',
      data: const {},
    );
    return response;
  }

  Future<void> syncPushTokenOnResume() async {
    if (!state.isAuthenticated || state.isOfflineAuth) return;
    if (!await NotificationService.instance.hasPushPermission()) return;

    final token = await NotificationService.instance.fetchFCMToken();
    if (token == null) return;

    final userId = state.user?.id;
    final alreadyBound = token == _currentFcmToken &&
        userId != null &&
        _pushBoundUserId == userId &&
        state.pushStatus == PushRegistrationStatus.registered;
    if (alreadyBound) return;

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

    final userId = state.user?.id;
    // Skip only if this exact token is already bound to this user.
    if (userId != null &&
        _pushBoundUserId == userId &&
        _currentFcmToken == token &&
        state.pushStatus == PushRegistrationStatus.registered) {
      return;
    }

    const maxRetries = 3;
    for (int attempt = 0; attempt < maxRetries; attempt++) {
      try {
        final response = await _apiClient.post<Map<String, dynamic>>(
          '/mobile/push-token',
          data: {
            'token': token,
            'deviceType': Platform.isIOS ? 'ios' : 'android',
          },
        );
        final masked = response['maskedToken'] as String?;
        _currentFcmToken = token;
        _pushBoundUserId = userId;
        state = state.copyWith(
          pushToken: token,
          backendMaskedToken: masked,
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
    _tokenSubscription?.cancel();
    _tokenSubscription = null;
    _currentFcmToken = null;
    _pushBoundUserId = null;

    await _storage.setToken(pair.accessToken);
    await _storage.setRefreshToken(pair.refreshToken);
    User? user;
    try {
      user = await _authService.fetchCurrentUser();
    } catch (_) {
      user = await _authService.getCurrentUser();
    }
    await _onSecurityChanged();
    state = AuthState(user: user, hasPersistedSession: true);
    unawaited(_setupPushIfPermitted());
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