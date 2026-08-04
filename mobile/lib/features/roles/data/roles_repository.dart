import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/permission.dart';
import '../domain/role.dart';

/// A user-facing error surfaced by the roles API — e.g. "Role name already
/// exists", "Cannot delete a system role", "Role is still assigned to
/// users". Carries the server's own message rather than a re-worded copy,
/// per the pattern in [AuthException].
class RoleApiException implements Exception {
  const RoleApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class RolesRepository {
  RolesRepository(this._dio);

  final Dio _dio;

  Future<List<MobileRole>> list() async {
    final response = await _dio.get<Map<String, dynamic>>('/roles');
    final data = response.data!['data'] as List<dynamic>;
    return data.map((e) => MobileRole.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<MobileRole> getById(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/roles/$id');
    return MobileRole.fromJson(response.data!['data'] as Map<String, dynamic>);
  }

  Future<List<MobilePermission>> listPermissions() async {
    final response = await _dio.get<Map<String, dynamic>>('/permissions');
    final data = response.data!['data'] as List<dynamic>;
    return data.map((e) => MobilePermission.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<MobileRole> create({
    required String name,
    required String? description,
    required List<String> permissionKeys,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/roles',
        data: {
          'name': name,
          if (description != null && description.isNotEmpty) 'description': description,
          'permissionKeys': permissionKeys,
        },
      );
      return MobileRole.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw RoleApiException(_extractError(e));
    }
  }

  Future<MobileRole> update({
    required String id,
    required String name,
    required String? description,
    required List<String> permissionKeys,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/roles/$id',
        data: {
          'name': name,
          if (description != null && description.isNotEmpty) 'description': description,
          'permissionKeys': permissionKeys,
        },
      );
      return MobileRole.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw RoleApiException(_extractError(e));
    }
  }

  Future<void> delete(String id) async {
    try {
      await _dio.delete<Map<String, dynamic>>('/roles/$id');
    } on DioException catch (e) {
      throw RoleApiException(_extractError(e));
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

final Provider<RolesRepository> rolesRepositoryProvider = Provider<RolesRepository>(
  (ref) => RolesRepository(ref.watch(apiClientProvider)),
);
