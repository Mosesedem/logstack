import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/config/app_config.dart';
import 'package:logstack_mobile/services/storage_service.dart';
import 'package:logstack_mobile/utils/auth_errors.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.watch(storageServiceProvider);
  return ApiClient(storage);
});

class ApiClient {
  final StorageService _storage;
  late final Dio _dio;
  Future<String?>? _refreshInFlight;

  static String get baseUrl => AppConfig.apiBaseUrl;

  ApiClient(this._storage) {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
      },
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        final skipRetry = error.requestOptions.extra['skipAuthRetry'] == true;
        if (!skipRetry &&
            error.response?.statusCode == 401 &&
            !_isAuthEndpoint(error.requestOptions.path)) {
          try {
            final newToken = await _refreshAccessToken();
            if (newToken != null) {
              error.requestOptions.headers['Authorization'] = 'Bearer $newToken';
              final response = await _dio.fetch(error.requestOptions);
              return handler.resolve(response);
            }
          } catch (_) {}
        }
        return handler.next(error);
      },
    ));
  }

  bool _isAuthEndpoint(String path) {
    return path.contains('/auth/mobile-refresh') ||
        path.contains('/auth/refresh') ||
        path.contains('/auth/login') ||
        path.contains('/auth/mobile-login') ||
        path.contains('/auth/qr/');
  }

  Future<String?> _refreshAccessToken() async {
    if (_refreshInFlight != null) {
      return _refreshInFlight;
    }

    _refreshInFlight = _doRefresh();
    try {
      return await _refreshInFlight;
    } finally {
      _refreshInFlight = null;
    }
  }

  Future<String?> _doRefresh() async {
    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken == null) return null;

    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/mobile-refresh',
        data: {'refreshToken': refreshToken},
        options: Options(extra: {'skipAuthRetry': true}),
      );
      final accessToken =
          (response.data?['accessToken'] ?? response.data?['access_token'])
              as String?;
      if (accessToken != null && accessToken.isNotEmpty) {
        await _storage.setToken(accessToken);
        return accessToken;
      }
    } catch (e) {
      if (isRevokedAuthError(e)) rethrow;
    }

    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
        options: Options(extra: {'skipAuthRetry': true}),
      );
      final data = response.data;
      final accessToken =
          (data?['accessToken'] ?? data?['access_token']) as String?;
      if (accessToken != null && accessToken.isNotEmpty) {
        await _storage.setToken(accessToken);
        return accessToken;
      }
    } catch (e) {
      if (isRevokedAuthError(e)) rethrow;
    }

    return null;
  }

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
    bool skipAuthRetry = false,
  }) async {
    try {
      final response = await _dio.get(
        path,
        queryParameters: queryParameters,
        options: Options(extra: {'skipAuthRetry': skipAuthRetry}),
      );
      if (fromJson != null) {
        return fromJson(response.data);
      }
      return response.data as T;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<T> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
    bool skipAuthRetry = false,
  }) async {
    try {
      final response = await _dio.post(
        path,
        data: data,
        queryParameters: queryParameters,
        options: Options(extra: {'skipAuthRetry': skipAuthRetry}),
      );
      if (fromJson != null) {
        return fromJson(response.data);
      }
      return response.data as T;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<T> put<T>(
    String path, {
    dynamic data,
    T Function(dynamic)? fromJson,
    bool skipAuthRetry = false,
  }) async {
    try {
      final response = await _dio.put(
        path,
        data: data,
        options: Options(extra: {'skipAuthRetry': skipAuthRetry}),
      );
      if (fromJson != null) {
        return fromJson(response.data);
      }
      return response.data as T;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> delete(String path) async {
    try {
      await _dio.delete(path);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Exception _handleError(DioException e) {
    if (e.response != null) {
      final data = e.response?.data;
      if (data is Map) {
        if (data.containsKey('message') && data['message'] is String) {
          return Exception(data['message'] as String);
        }
        if (data.containsKey('error') && data['error'] is String) {
          return Exception(data['error'] as String);
        }
        if (data.containsKey('code') && data['code'] is String) {
          return Exception(data['code'] as String);
        }
      }
      return Exception('Request failed: ${e.response?.statusCode}');
    }
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return Exception('Connection timeout');
    }
    return Exception('Network error: ${e.message}');
  }
}