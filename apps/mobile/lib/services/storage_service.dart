import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

final storageServiceProvider = Provider<StorageService>((ref) {
  return StorageService();
});

class StorageService {
  static const String _tokenKey = 'auth_token';
  static const String _userKey = 'user_data';
  static const String _projectKey = 'current_project';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _biometricEnabledKey = 'biometric_enabled';
  static const String _appLockModeKey = 'app_lock_mode';
  static const String _appPinHashKey = 'app_pin_hash';
  static const String _onboardingCompleteKey = 'onboarding_complete';

  static const _secureStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<SharedPreferences> get _prefs async =>
      await SharedPreferences.getInstance();

  // Access token — secure storage only
  Future<void> setToken(String token) async {
    await _secureStorage.write(key: _tokenKey, value: token);
  }

  Future<String?> getToken() async {
    return _secureStorage.read(key: _tokenKey);
  }

  Future<void> clearToken() async {
    await _secureStorage.delete(key: _tokenKey);
  }

  // User data
  Future<void> setUserData(String userData) async {
    final prefs = await _prefs;
    await prefs.setString(_userKey, userData);
  }

  Future<String?> getUserData() async {
    final prefs = await _prefs;
    return prefs.getString(_userKey);
  }

  Future<void> clearUserData() async {
    final prefs = await _prefs;
    await prefs.remove(_userKey);
  }

  // Current project
  Future<void> setCurrentProject(String projectId) async {
    final prefs = await _prefs;
    await prefs.setString(_projectKey, projectId);
  }

  Future<String?> getCurrentProject() async {
    final prefs = await _prefs;
    return prefs.getString(_projectKey);
  }

  // Clear all
  Future<void> clearAll() async {
    final prefs = await _prefs;
    await prefs.clear();
    await _secureStorage.delete(key: _refreshTokenKey);
    await _secureStorage.delete(key: _tokenKey);
  }

  // Refresh token (stored in secure storage)
  Future<void> setRefreshToken(String token) async {
    await _secureStorage.write(key: _refreshTokenKey, value: token);
  }

  Future<String?> getRefreshToken() async {
    return _secureStorage.read(key: _refreshTokenKey);
  }

  Future<void> clearRefreshToken() async {
    await _secureStorage.delete(key: _refreshTokenKey);
  }

  Future<void> setBiometricEnabled(bool enabled) async {
    final prefs = await _prefs;
    await prefs.setBool(_biometricEnabledKey, enabled);
  }

  Future<bool> isBiometricEnabled() async {
    final prefs = await _prefs;
    return prefs.getBool(_biometricEnabledKey) ?? false;
  }

  Future<void> setAppLockMode(String mode) async {
    final prefs = await _prefs;
    await prefs.setString(_appLockModeKey, mode);
  }

  Future<String> getAppLockMode() async {
    final prefs = await _prefs;
    return prefs.getString(_appLockModeKey) ?? 'immediate';
  }

  Future<void> setAppPinHash(String hash) async {
    await _secureStorage.write(key: _appPinHashKey, value: hash);
  }

  Future<String?> getAppPinHash() async {
    return _secureStorage.read(key: _appPinHashKey);
  }

  Future<void> clearAppPinHash() async {
    await _secureStorage.delete(key: _appPinHashKey);
  }

  Future<bool> isOnboardingComplete() async {
    final prefs = await _prefs;
    return prefs.getBool(_onboardingCompleteKey) ?? false;
  }

  Future<void> setOnboardingComplete(bool complete) async {
    final prefs = await _prefs;
    await prefs.setBool(_onboardingCompleteKey, complete);
  }
}
