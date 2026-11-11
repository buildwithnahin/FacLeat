import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/application/auth_controller.dart';
import '../storage/secure_storage.dart';

/// Base URL for the mobile API surface. Change this single constant when
/// pointing the app at a staging server or a physical device (where
/// `localhost` won't resolve to the dev machine).
const String kApiBaseUrl = 'https://annex-leather-back-end.onrender.com/api/mobile';

/// Attaches the in-memory access token to every request and transparently
/// refreshes + retries once on a 401. Concurrent 401s share a single
/// in-flight refresh via [_refreshCompleter] instead of each firing their
/// own refresh call.
class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._ref, this._dio, this._refreshDio);

  final Ref _ref;
  final Dio _dio;
  final Dio _refreshDio;

  Completer<void>? _refreshCompleter;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final token = _ref.read(authControllerProvider).accessToken;
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final statusCode = err.response?.statusCode;
    final alreadyRetried = err.requestOptions.extra['retried'] == true;

    if (statusCode != 401 || alreadyRetried) {
      handler.next(err);
      return;
    }

    try {
      await _refreshToken();
      final retryOptions = err.requestOptions;
      retryOptions.extra['retried'] = true;
      final freshToken = _ref.read(authControllerProvider).accessToken;
      retryOptions.headers['Authorization'] = 'Bearer $freshToken';
      final response = await _dio.fetch<dynamic>(retryOptions);
      handler.resolve(response);
    } catch (_) {
      await _ref.read(authControllerProvider.notifier).logout();
      handler.next(err);
    }
  }

  Future<void> _refreshToken() {
    final existing = _refreshCompleter;
    if (existing != null) return existing.future;

    final completer = Completer<void>();
    _refreshCompleter = completer;

    _doRefresh().then((_) {
      completer.complete();
    }).catchError((Object error) {
      completer.completeError(error);
    }).whenComplete(() {
      _refreshCompleter = null;
    });

    return completer.future;
  }

  Future<void> _doRefresh() async {
    final storage = _ref.read(secureStorageProvider);
    final refreshToken = await storage.getRefreshToken();
    if (refreshToken == null) {
      throw StateError('No refresh token available');
    }
    final response = await _refreshDio.post<Map<String, dynamic>>(
      '/auth/refresh',
      data: {'refreshToken': refreshToken},
    );
    final data = response.data!['data'] as Map<String, dynamic>;
    final newAccessToken = data['accessToken'] as String;
    final newRefreshToken = data['refreshToken'] as String;

    _ref.read(authControllerProvider.notifier).updateAccessToken(newAccessToken);
    await storage.setRefreshToken(newRefreshToken);
  }
}

/// Authenticated Dio instance for all `/api/mobile/**` calls other than
/// `/auth/login` and `/auth/refresh` (which use [authRepositoryProvider]'s
/// own unauthenticated client instead).
final Provider<Dio> apiClientProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: kApiBaseUrl,
      headers: const {'Content-Type': 'application/json'},
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
    ),
  );
  // A separate, interceptor-free client for the refresh call itself, so a
  // refresh failure can never recursively trigger another refresh.
  final refreshDio = Dio(
    BaseOptions(
      baseUrl: kApiBaseUrl,
      headers: const {'Content-Type': 'application/json'},
    ),
  );
  dio.interceptors.add(AuthInterceptor(ref, dio, refreshDio));
  return dio;
});
