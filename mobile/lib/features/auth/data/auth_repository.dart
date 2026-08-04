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
