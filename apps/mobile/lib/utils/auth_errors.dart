import 'package:dio/dio.dart';

bool isRevokedAuthError(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map && data['code'] == 'TOKEN_REVOKED') {
      return true;
    }
    if (data is Map && data['code'] == 'INVALID_REFRESH_TOKEN') {
      return true;
    }
  }
  final message = error.toString().toLowerCase();
  return message.contains('token_revoked') ||
      message.contains('invalid or expired refresh token') ||
      message.contains('refresh token has been revoked');
}

bool isNetworkError(Object error) {
  if (error is DioException) {
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.connectionError) {
      return true;
    }
    return error.response == null;
  }
  final message = error.toString().toLowerCase();
  return message.contains('network error') ||
      message.contains('connection timeout') ||
      message.contains('socketexception') ||
      message.contains('failed host lookup');
}