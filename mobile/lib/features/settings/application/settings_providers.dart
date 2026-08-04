import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/mobile_session.dart';

/// Every active login session for the current user (`GET /auth/sessions`) —
/// one row per device/browser that has a live refresh token, newest first.
final FutureProvider<List<MobileSessionInfo>> sessionsProvider =
    FutureProvider<List<MobileSessionInfo>>((ref) async {
  final dio = ref.watch(apiClientProvider);
  final response = await dio.get<Map<String, dynamic>>('/auth/sessions');
  final data = response.data!['data'] as List<dynamic>;
  return data.map((e) => MobileSessionInfo.fromJson(e as Map<String, dynamic>)).toList();
});

/// Revokes one session by id (`DELETE /auth/sessions/:id`) and refreshes
/// [sessionsProvider] so the list updates immediately. If the revoked
/// session is the one this device is using, its next authenticated request
/// will 401 and the existing refresh-token interceptor will sign it out —
/// there's no separate "is this my session" handling needed here.
Future<void> revokeMobileSession(WidgetRef ref, String sessionId) async {
  final dio = ref.read(apiClientProvider);
  await dio.delete<Map<String, dynamic>>('/auth/sessions/$sessionId');
  ref.invalidate(sessionsProvider);
}
