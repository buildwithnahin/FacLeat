import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/announcement.dart';

/// A user-facing error surfaced by the announcements API — either a 422
/// validation message (first field error surfaced, e.g. "Branch is required
/// for branch-targeted announcements") or a generic server rejection.
/// Carries the server's own message, per the pattern in [RoleApiException].
class AnnouncementApiException implements Exception {
  const AnnouncementApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class AnnouncementsRepository {
  AnnouncementsRepository(this._dio);

  final Dio _dio;

  Future<List<Announcement>> list({int? limit}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/announcements',
        queryParameters: {'limit': ?limit},
      );
      final data = response.data!['data'] as List<dynamic>;
      return data.map((e) => Announcement.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw AnnouncementApiException(_extractError(e));
    }
  }

  Future<Announcement> getById(String id) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/announcements/$id');
      return Announcement.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw AnnouncementApiException(_extractError(e));
    }
  }

  Future<Announcement> create({
    required String title,
    required String body,
    required String audienceType,
    String? audienceBranchId,
    String? audienceDepartment,
    String? audienceUserId,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/announcements',
        data: {
          'title': title,
          'body': body,
          'audienceType': audienceType,
          'audienceBranchId': ?audienceBranchId,
          'audienceDepartment': ?audienceDepartment,
          'audienceUserId': ?audienceUserId,
        },
      );
      return Announcement.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw AnnouncementApiException(_extractError(e));
    }
  }

  /// Extracts a user-facing message from a failed request. A 422 validation
  /// error has shape `{success:false, error:'Validation failed',
  /// details:{fieldErrors:{...}}}` — in that case the first field error
  /// message is surfaced instead of the generic "Validation failed" string.
  String _extractError(DioException e) {
    final data = e.response?.data;
    if (data is Map) {
      final details = data['details'];
      if (details is Map) {
        final fieldErrors = details['fieldErrors'];
        if (fieldErrors is Map) {
          for (final value in fieldErrors.values) {
            if (value is List && value.isNotEmpty) {
              return value.first.toString();
            }
          }
        }
      }
      if (data['error'] is String) {
        return data['error'] as String;
      }
    }
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'Could not reach the server. Please check your connection.';
    }
    return 'Something went wrong. Please try again.';
  }
}

final Provider<AnnouncementsRepository> announcementsRepositoryProvider =
    Provider<AnnouncementsRepository>(
  (ref) => AnnouncementsRepository(ref.watch(apiClientProvider)),
);
