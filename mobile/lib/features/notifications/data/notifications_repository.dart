import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/notification_item.dart';

/// Thin wrapper over the `/notifications` REST surface (base path resolves
/// through [apiClientProvider]'s `/api/mobile` prefix to
/// `/api/mobile/notifications`).
class NotificationsRepository {
  NotificationsRepository(this._dio);

  final Dio _dio;

  /// `GET /notifications?unread=1&limit=N`. Pass `unreadOnly: true` to only
  /// fetch unread rows; `null`/`false` omits the `unread` query param
  /// entirely so the server returns everything, per the API contract.
  Future<List<NotificationItem>> list({bool? unreadOnly, int limit = 50}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/notifications',
      queryParameters: {
        if (unreadOnly == true) 'unread': 1,
        'limit': limit,
      },
    );
    final data = response.data!['data'] as List<dynamic>;
    return data
        .map((e) => NotificationItem.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  /// `GET /notifications/unread-count`.
  Future<int> unreadCount() async {
    final response = await _dio.get<Map<String, dynamic>>('/notifications/unread-count');
    final data = response.data!['data'] as Map<String, dynamic>;
    return (data['count'] as num?)?.toInt() ?? 0;
  }

  /// `POST /notifications/:id/read`.
  Future<NotificationItem> markRead(String id) async {
    final response = await _dio.post<Map<String, dynamic>>('/notifications/$id/read');
    return NotificationItem.fromJson(Map<String, dynamic>.from(response.data!['data'] as Map));
  }

  /// `POST /notifications/read-all`. Returns the number of rows updated.
  Future<int> markAllRead() async {
    final response = await _dio.post<Map<String, dynamic>>('/notifications/read-all');
    final data = response.data!['data'] as Map<String, dynamic>;
    return (data['updated'] as num?)?.toInt() ?? 0;
  }
}

final Provider<NotificationsRepository> notificationsRepositoryProvider =
    Provider<NotificationsRepository>(
  (ref) => NotificationsRepository(ref.watch(apiClientProvider)),
);
