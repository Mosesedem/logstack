import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/user.dart';
import 'package:logstack_mobile/services/api_client.dart';
import 'package:logstack_mobile/services/storage_service.dart';
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

  /// Email/password login — uses mobile-login for persistent refresh tokens.
  Future<AuthResponse> login({
    required String email,
    required String password,
  }) async {
    final response = await _api.post<Map<String, dynamic>>(
      '/auth/mobile-login',
      data: {'email': email, 'password': password},
    );

    final authResponse = AuthResponse.fromJson(response);
    await _persistSession(authResponse);
    return authResponse;
  }

  Future<User> fetchCurrentUser() async {
    final response = await _api.get<Map<String, dynamic>>('/users/me');
    final user = User.fromJson(response);
    await _storage.setUserData(jsonEncode(user.toJson()));
    return user;
  }

  Future<void> _persistSession(AuthResponse authResponse) async {
    await _storage.setToken(authResponse.accessToken);
    if (authResponse.refreshToken.isNotEmpty) {
      await _storage.setRefreshToken(authResponse.refreshToken);
    }
    await _storage.setUserData(jsonEncode(authResponse.user.toJson()));
  }

  /// Confirms a QR login session — no credentials; web user is pre-bound.
  Future<TokenPair> confirmQR(String token) async {
    final response = await _api.post<Map<String, dynamic>>(
      '/auth/qr/$token/confirm',
      data: <String, dynamic>{},
    );
    return TokenPair.fromJson(response);
  }

  /// Confirms a QR link session using a 6-digit PIN only.
  Future<TokenPair> confirmQRByPIN(String pin) async {
    final response = await _api.post<Map<String, dynamic>>(
      '/auth/qr/pin-confirm',
      data: {'pin': pin},
    );
    return TokenPair.fromJson(response);
  }

  Future<String> refreshAccessToken(String refreshToken) async {
    final response = await _api.post<Map<String, dynamic>>(
      '/auth/refresh',
      data: {'refreshToken': refreshToken},
      skipAuthRetry: true,
    );
    return (response['accessToken'] ?? response['access_token'] ?? '') as String;
  }

  Future<String> refreshMobileAccessToken(String refreshToken) async {
    final response = await _api.post<Map<String, dynamic>>(
      '/auth/mobile-refresh',
      data: {'refreshToken': refreshToken},
      skipAuthRetry: true,
    );
    return (response['accessToken'] ?? response['access_token'] ?? '') as String;
  }

  Future<String> refreshStoredAccessToken() async {
    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken == null) {
      throw Exception('No refresh token stored');
    }
    try {
      return await refreshMobileAccessToken(refreshToken);
    } catch (_) {
      final pair = await _api.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
        skipAuthRetry: true,
      );
      return (pair['accessToken'] ?? pair['access_token'] ?? '') as String;
    }
  }

  Future<void> revokeRefreshToken(String refreshToken) async {
    try {
      await _api.post<void>(
        '/auth/mobile-logout',
        data: {'refreshToken': refreshToken},
      );
    } catch (_) {}
  }

  Future<void> logout() async {
    await _storage.clearAll();
  }

  Future<User?> getCurrentUser() async {
    final userData = await _storage.getUserData();
    if (userData == null) return null;
    return User.fromJson(jsonDecode(userData));
  }

  Future<bool> isAuthenticated() async {
    final token = await _storage.getToken();
    final refresh = await _storage.getRefreshToken();
    return token != null || refresh != null;
  }
}