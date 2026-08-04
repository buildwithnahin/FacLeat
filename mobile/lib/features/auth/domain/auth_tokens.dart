import 'package:equatable/equatable.dart';

import 'mobile_user.dart';

/// A short-lived access token + rotating refresh token pair.
class AuthTokens extends Equatable {
  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
  });

  factory AuthTokens.fromJson(Map<String, dynamic> json) => AuthTokens(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
        expiresIn: json['expiresIn'] as int,
      );

  final String accessToken;
  final String refreshToken;
  final int expiresIn;

  @override
  List<Object?> get props => [accessToken, refreshToken, expiresIn];
}

/// Full login result: tokens + the authenticated user.
class LoginResult extends Equatable {
  const LoginResult({required this.tokens, required this.user});

  final AuthTokens tokens;
  final MobileUser user;

  @override
  List<Object?> get props => [tokens, user];
}
