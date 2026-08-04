import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/notifications_repository.dart';
import '../domain/notification_item.dart';

/// Cap passed as `?limit=` on every `GET /notifications` call — the
/// Notification Center is a capped, non-paginated list (unlike Audit Log).
const int notificationsListLimit = 50;

/// Backs the All/Unread filter toggle on [NotificationCenterScreen]. A
/// dedicated `Notifier<bool>` (rather than folding the flag into
/// [notificationsListProvider] as a family) keeps a single stable provider
/// the filter chips can read/write directly.
class NotificationsUnreadOnlyNotifier extends Notifier<bool> {
  @override
  bool build() => false;

  void set(bool value) => state = value;
}

final NotifierProvider<NotificationsUnreadOnlyNotifier, bool> notificationsUnreadOnlyProvider =
    NotifierProvider<NotificationsUnreadOnlyNotifier, bool>(NotificationsUnreadOnlyNotifier.new);

/// The notification feed for whatever filter [notificationsUnreadOnlyProvider]
/// currently holds. Re-fetches automatically when that filter changes.
final FutureProvider<List<NotificationItem>> notificationsListProvider =
    FutureProvider<List<NotificationItem>>((ref) async {
  final unreadOnly = ref.watch(notificationsUnreadOnlyProvider);
  final repository = ref.watch(notificationsRepositoryProvider);
  return repository.list(unreadOnly: unreadOnly ? true : null, limit: notificationsListLimit);
});

/// Unread badge count for [NotificationBell] — independent of whatever
/// filter the Notification Center screen currently has selected.
final FutureProvider<int> unreadCountProvider = FutureProvider<int>((ref) async {
  final repository = ref.watch(notificationsRepositoryProvider);
  return repository.unreadCount();
});

/// Marks one notification read, then refreshes the list + badge count.
Future<void> markNotificationRead(WidgetRef ref, String id) async {
  final repository = ref.read(notificationsRepositoryProvider);
  await repository.markRead(id);
  ref.invalidate(notificationsListProvider);
  ref.invalidate(unreadCountProvider);
}

/// Marks every notification read, then refreshes the list + badge count.
Future<void> markAllNotificationsRead(WidgetRef ref) async {
  final repository = ref.read(notificationsRepositoryProvider);
  await repository.markAllRead();
  ref.invalidate(notificationsListProvider);
  ref.invalidate(unreadCountProvider);
}

/// Keeps a long-lived SSE connection open to `GET /sse/notifications` for as
/// long as something `ref.watch`es this provider. Its only job is to
/// invalidate [notificationsListProvider] and [unreadCountProvider] whenever
/// a real notification event arrives, so the UI refetches through the normal
/// REST path instead of merging the SSE payload into cached state by hand.
///
/// Dio has no built-in `EventSource`, and this endpoint needs a custom
/// `Authorization` header a plain `EventSource` package can't send — so the
/// stream is read manually via `ResponseType.stream`. Incoming `Uint8List`
/// chunks don't line up with SSE event boundaries, so bytes are UTF-8
/// decoded and appended to a string buffer; whenever the buffer contains a
/// `\n\n` (the SSE event separator) the buffer is split there and everything
/// before it is treated as one complete event. Within an event, lines
/// starting with `:` (keepalive comments) are skipped, `data: ` is stripped
/// from the remaining line, and the payload is `jsonDecode`d — the
/// `{"type":"connected",...}` handshake object is filtered out, and anything
/// else with an `id` field is treated as a new/changed [NotificationItem]
/// and triggers the two invalidations. Stream errors (dropped connection,
/// non-2xx response, decode failure) are funneled into this provider's
/// `AsyncValue.error` state rather than thrown — a consumer can retry by
/// re-watching; there's no automatic reconnect-with-backoff in this pass.
final StreamProvider<void> notificationsSseProvider = StreamProvider<void>((ref) {
  final dio = ref.watch(apiClientProvider);
  final controller = StreamController<void>();
  StreamSubscription<Uint8List>? subscription;
  var buffer = '';

  void handleRawEvent(String rawEvent) {
    for (final rawLine in rawEvent.split('\n')) {
      final line = rawLine.trim();
      if (line.isEmpty || line.startsWith(':')) continue; // keepalive comment
      if (!line.startsWith('data:')) continue;

      final payload = line.substring('data:'.length).trim();
      if (payload.isEmpty) continue;

      Object? decoded;
      try {
        decoded = jsonDecode(payload);
      } catch (_) {
        continue; // malformed event — ignore and keep the connection alive
      }
      if (decoded is! Map<String, dynamic>) continue;
      if (decoded['type'] == 'connected') continue; // initial handshake payload
      if (decoded['id'] == null) continue; // not a NotificationItem-shaped event

      ref.invalidate(notificationsListProvider);
      ref.invalidate(unreadCountProvider);
      if (!controller.isClosed) controller.add(null);
    }
  }

  Future<void> connect() async {
    try {
      final response = await dio.get<ResponseBody>(
        '/sse/notifications',
        options: Options(
          responseType: ResponseType.stream,
          headers: {'Accept': 'text/event-stream'},
        ),
      );

      subscription = response.data!.stream.listen(
        (chunk) {
          buffer += utf8.decode(chunk, allowMalformed: true);
          var boundary = buffer.indexOf('\n\n');
          while (boundary != -1) {
            handleRawEvent(buffer.substring(0, boundary));
            buffer = buffer.substring(boundary + 2);
            boundary = buffer.indexOf('\n\n');
          }
        },
        onError: (Object error, StackTrace stackTrace) {
          if (!controller.isClosed) controller.addError(error, stackTrace);
        },
        onDone: () {
          if (!controller.isClosed) controller.close();
        },
        cancelOnError: true,
      );
    } catch (error, stackTrace) {
      if (!controller.isClosed) controller.addError(error, stackTrace);
    }
  }

  connect();

  ref.onDispose(() {
    subscription?.cancel();
    if (!controller.isClosed) controller.close();
  });

  return controller.stream;
});
