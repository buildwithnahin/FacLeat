import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

/// A user-facing error surfaced by the change-password API — e.g. "Current
/// password is incorrect", or a validation message extracted from
/// `details.fieldErrors` when the server rejects the new password. Carries
/// the server's own message, per the pattern in [ApprovalApiException].
class ChangePasswordException implements Exception {
  const ChangePasswordException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Changes the signed-in user's own password (`PATCH /me/password`).
/// [currentPassword] must match the account's existing password server-side;
/// [newPassword] must be at least 8 characters (also checked client-side by
/// the form before this is ever called, so the server-side length rejection
/// should rarely be hit in practice).
Future<void> changeOwnPassword(
  WidgetRef ref, {
  required String currentPassword,
  required String newPassword,
}) async {
  final dio = ref.read(apiClientProvider);
  try {
    await dio.patch<Map<String, dynamic>>(
      '/me/password',
      data: {'currentPassword': currentPassword, 'newPassword': newPassword},
    );
  } on DioException catch (e) {
    throw ChangePasswordException(_extractError(e));
  }
}

String _extractError(DioException e) {
  final data = e.response?.data;
  if (data is Map) {
    final error = data['error'];
    if (error is String && error.isNotEmpty) {
      if (error == 'Validation failed') {
        final fieldMessage = _firstFieldError(data['details']);
        if (fieldMessage != null) return fieldMessage;
      }
      return error;
    }
  }
  if (e.type == DioExceptionType.connectionError ||
      e.type == DioExceptionType.connectionTimeout ||
      e.type == DioExceptionType.receiveTimeout) {
    return 'Could not reach the server. Please check your connection.';
  }
  return 'Something went wrong. Please try again.';
}

/// Pulls the first message out of a Zod-flatten-shaped
/// `{ fieldErrors: { field: ['message', ...] } }` payload, if present.
String? _firstFieldError(Object? details) {
  if (details is! Map) return null;
  final fieldErrors = details['fieldErrors'];
  if (fieldErrors is! Map) return null;
  for (final value in fieldErrors.values) {
    if (value is List && value.isNotEmpty && value.first is String) {
      return value.first as String;
    }
  }
  return null;
}
