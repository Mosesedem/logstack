import 'package:freezed_annotation/freezed_annotation.dart';

part 'user.freezed.dart';
part 'user.g.dart';

@freezed
class User with _$User {
  const factory User({
    required int id,
    required String email,
    String? name,
    required DateTime createdAt,
  }) = _User;

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
}

/// Login/signup response from the API: `{ user, tokens: { accessToken, refreshToken } }`.
class AuthResponse {
  final User user;
  final String accessToken;
  final String refreshToken;

  const AuthResponse({
    required this.user,
    required this.accessToken,
    required this.refreshToken,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    final tokens = json['tokens'] as Map<String, dynamic>? ?? json;
    return AuthResponse(
      user: User.fromJson(json['user'] as Map<String, dynamic>),
      accessToken: (tokens['accessToken'] ??
              tokens['access_token'] ??
              json['token'] ??
              '') as String,
      refreshToken: (tokens['refreshToken'] ??
              tokens['refresh_token'] ??
              '') as String,
    );
  }

  /// Legacy alias used by older call sites.
  String get token => accessToken;
}

/// Represents a JWT token pair returned by QR confirm and similar endpoints.
class TokenPair {
  final String accessToken;
  final String refreshToken;

  const TokenPair({
    required this.accessToken,
    required this.refreshToken,
  });

  factory TokenPair.fromJson(Map<String, dynamic> json) {
    return TokenPair(
      accessToken: (json['accessToken'] ??
              json['access_token'] ??
              json['token'] ??
              '') as String,
      refreshToken: (json['refreshToken'] ??
              json['refresh_token'] ??
              '') as String,
    );
  }

  Map<String, dynamic> toJson() => {
        'accessToken': accessToken,
        'refreshToken': refreshToken,
      };
}