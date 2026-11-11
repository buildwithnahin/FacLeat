import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/auth_exception.dart';
import '../domain/auth_tokens.dart';
import '../domain/mobile_user.dart';

/// Talks to the unauthenticated `/auth/*` endpoints. Deliberately uses a
/// plain [Dio] instance with no Authorization header / refresh interceptor,
/// since login and refresh calls must never carry (or trigger refreshing of)
/// an access token themselves.
class AuthRepository {
  AuthRepository(this._dio);

  final Dio _dio;

  Future<LoginResult> login({
    required String email,
    required String password,
    String? deviceLabel,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {
          'email': email,
          'password': password,
          'deviceLabel': ?deviceLabel,
        },
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      return LoginResult(
        tokens: AuthTokens.fromJson(data),
        user: MobileUser.fromJson(data['user'] as Map<String, dynamic>),
      );
    } on DioException catch (e) {
      throw AuthException(_extractError(e));
    }
  }

  /// One-click "Quick login" — the mobile app is Super-Admin-only by design,
  /// so this always resolves to that single seeded account. The real
  /// password is never sent from this app; the backend's quick-login route
  /// resolves and checks it entirely server-side from a role key. See
  /// backend/src/server/auth/quick-login-accounts.ts for the account list
  /// and the explicit no-gate risk decision behind this feature.
  Future<LoginResult> quickLogin({String roleKey = 'SUPER_ADMIN', String? deviceLabel}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/quick-login',
        data: {
          'roleKey': roleKey,
          'deviceLabel': ?deviceLabel,
        },
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      return LoginResult(
        tokens: AuthTokens.fromJson(data),
        user: MobileUser.fromJson(data['user'] as Map<String, dynamic>),
      );
    } on DioException catch (e) {
      throw AuthException(_extractError(e));
    }
  }

  Future<AuthTokens> refresh(String refreshToken) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      return AuthTokens.fromJson(data);
    } on DioException catch (e) {
      throw AuthException(_extractError(e));
    }
  }

  /// Revokes this device's refresh token server-side (`MobileRefreshToken.revokedAt`)
  /// so it can no longer be used to mint new access tokens after logout —
  /// without this, "logging out" only cleared local state and left the
  /// session live in the backend (and in the Settings "Active sessions" list)
  /// until it naturally expired. Best-effort: the caller always clears local
  /// state regardless of whether this call succeeds, since a device with no
  /// network shouldn't be blocked from logging out locally.
  Future<void> logout(String refreshToken) async {
    try {
      await _dio.post<Map<String, dynamic>>('/auth/logout', data: {'refreshToken': refreshToken});
    } on DioException {
      // Ignored — local logout proceeds either way (see doc comment above).
    }
  }

  String _extractError(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['error'] is String) {
      return data['error'] as String;
    }
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'Could not reach the server. Please check your connection.';
    }
    return 'Something went wrong. Please try again.';
  }
}

final Provider<AuthRepository> authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(
    Dio(
      BaseOptions(
        baseUrl: kApiBaseUrl,
        headers: const {'Content-Type': 'application/json'},
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
      ),
    ),
  ),
);
