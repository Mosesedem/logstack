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

  static const _secureStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<SharedPreferences> get _prefs async =>
      await SharedPreferences.getInstance();

  // Token management
  Future<void> setToken(String token) async {
    final prefs = await _prefs;
    await prefs.setString(_tokenKey, token);
  }

  Future<String?> getToken() async {
    final prefs = await _prefs;
    return prefs.getString(_tokenKey);
  }

  Future<void> clearToken() async {
    final prefs = await _prefs;
    await prefs.remove(_tokenKey);
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
}
