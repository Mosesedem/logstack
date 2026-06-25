import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/user.dart';
import 'package:logstack_mobile/services/api_client.dart';
import 'package:logstack_mobile/services/storage_service.dart';
import 'package:logstack_mobile/services/notification_service.dart';
import 'dart:convert';

final authServiceProvider = Provider<AuthService>((ref) {
  final api = ref.watch(apiClientProvider);
  final storage = ref.watch(storageServiceProvider);
  return AuthService(api, storage);
});

class AuthService {
  final ApiClient _api;
  final StorageService _storage;

  AuthService(this._api, this._storage);

  Future<AuthResponse> login({
    required String email,
    required String password,
  }) async {
    final response = await _api.post<Map<String, dynamic>>(
      '/auth/login',
      data: {'email': email, 'password': password},
    );

    final authResponse = AuthResponse.fromJson(response);
    await _storage.setToken(authResponse.token);
    await _storage.setUserData(jsonEncode(authResponse.user.toJson()));

    // Register FCM token after login
    await _registerPushToken();

    return authResponse;
  }

  Future<AuthResponse> signup({
    required String email,
    required String password,
  }) async {
    final response = await _api.post<Map<String, dynamic>>(
      '/auth/signup',
      data: {'email': email, 'password': password},
    );

    final authResponse = AuthResponse.fromJson(response);
    await _storage.setToken(authResponse.token);
    await _storage.setUserData(jsonEncode(authResponse.user.toJson()));

    // Register FCM token after signup
    await _registerPushToken();

    return authResponse;
  }

  /// Confirms a QR login session.
  ///
  /// Calls `POST /auth/qr/:token/confirm` with [email] and [password] credentials.
  /// Returns a [TokenPair] containing the access and refresh tokens issued to
  /// the mobile caller.
  Future<TokenPair> confirmQR(
    String token,
    String email,
    String password,
  ) async {
    final response = await _api.post<Map<String, dynamic>>(
      '/auth/qr/$token/confirm',
      data: {'email': email, 'password': password},
    );
    return TokenPair.fromJson(response);
  }

  /// Confirms a QR link session using a 6-digit PIN instead of scanning.
  ///
  /// Calls `POST /auth/qr/pin-confirm` with [pin], [email] and [password].
  /// Returns a [TokenPair] containing the access and refresh tokens.
  Future<TokenPair> confirmQRByPIN(
    String pin,
    String email,
    String password,
  ) async {
    final response = await _api.post<Map<String, dynamic>>(
      '/auth/qr/pin-confirm',
      data: {'pin': pin, 'email': email, 'password': password},
    );
    return TokenPair.fromJson(response);
  }

  /// Silently refreshes the access token using the stored [refreshToken].
  ///
  /// Calls `POST /auth/mobile-refresh` and returns the new access token string.
  Future<String> refreshAccessToken(String refreshToken) async {
    final response = await _api.post<Map<String, dynamic>>(
      '/auth/mobile-refresh',
      data: {'refreshToken': refreshToken},
    );
    return response['accessToken'] as String;
  }

  /// Revokes the given [refreshToken] on the server (fire-and-forget).
  ///
  /// Calls `POST /auth/mobile-logout`. Errors are silently swallowed.
  Future<void> revokeRefreshToken(String refreshToken) async {
    try {
      await _api.post<void>(
        '/auth/mobile-logout',
        data: {'refreshToken': refreshToken},
      );
    } catch (_) {
      // Fire-and-forget — swallow errors
    }
  }

  Future<void> logout() async {
    // Unregister push token before logout
    await _unregisterPushToken();
    await _storage.clearAll();
  }

  Future<User?> getCurrentUser() async {
    final userData = await _storage.getUserData();
    if (userData == null) return null;
    return User.fromJson(jsonDecode(userData));
  }

  Future<bool> isAuthenticated() async {
    final token = await _storage.getToken();
    return token != null;
  }

  Future<void> _registerPushToken() async {
    final fcmToken = NotificationService.instance.fcmToken;
    if (fcmToken != null) {
      try {
        await _api.post('/mobile/push-tokens', data: {
          'token': fcmToken,
          'platform': _getPlatform(),
        });
      } catch (e) {
        // Silently fail - push notifications are optional
      }
    }
  }

  Future<void> _unregisterPushToken() async {
    final fcmToken = NotificationService.instance.fcmToken;
    if (fcmToken != null) {
      try {
        await _api.delete('/mobile/push-tokens/$fcmToken');
      } catch (e) {
        // Silently fail
      }
    }
  }

  String _getPlatform() {
    // In a real app, use Platform.isIOS / Platform.isAndroid
    return 'ios'; // or 'android'
  }
}
