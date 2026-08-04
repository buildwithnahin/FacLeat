import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/admin_user.dart';

/// A user-facing error surfaced by the users API, carrying the server's own
/// message (see [RoleApiException] for the equivalent in the roles feature).
class UserApiException implements Exception {
  const UserApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class UsersRepository {
  UsersRepository(this._dio);

  final Dio _dio;

  Future<List<AdminUser>> list() async {
    final response = await _dio.get<Map<String, dynamic>>('/users');
    final data = response.data!['data'] as List<dynamic>;
    return data.map((e) => AdminUser.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<AdminUser> getById(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/users/$id');
    return AdminUser.fromJson(response.data!['data'] as Map<String, dynamic>);
  }

  Future<AdminUser> setStatus(String id, String status) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/users/$id/status',
        data: {'status': status},
      );
      return AdminUser.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw UserApiException(_extractError(e));
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

final Provider<UsersRepository> usersRepositoryProvider = Provider<UsersRepository>(
  (ref) => UsersRepository(ref.watch(apiClientProvider)),
);
