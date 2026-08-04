import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/approval_request.dart';

/// Queue-wide counts from `GET /approvals/queue-stats`.
class ApprovalQueueStats {
  const ApprovalQueueStats({required this.pending, required this.approved, required this.rejected});

  factory ApprovalQueueStats.fromJson(Map<String, dynamic> json) => ApprovalQueueStats(
        pending: json['pending'] as int? ?? 0,
        approved: json['approved'] as int? ?? 0,
        rejected: json['rejected'] as int? ?? 0,
      );

  final int pending;
  final int approved;
  final int rejected;
}

/// A user-facing error surfaced by the approvals API — e.g. "Only the
/// requester can cancel this request", "Request is no longer pending".
/// Carries the server's own message, per the pattern in [RoleApiException].
class ApprovalApiException implements Exception {
  const ApprovalApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class ApprovalsRepository {
  ApprovalsRepository(this._dio);

  final Dio _dio;

  Future<List<ApprovalRequest>> list({String? status, bool? mine, bool? forMe}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/approvals',
        queryParameters: {
          if (status != null && status.isNotEmpty) 'status': status,
          if (mine == true) 'mine': 1,
          if (forMe == true) 'forMe': 1,
        },
      );
      final data = response.data!['data'] as List<dynamic>;
      return data.map((e) => ApprovalRequest.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApprovalApiException(_extractError(e));
    }
  }

  Future<ApprovalRequest> getById(String id) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/approvals/$id');
      return ApprovalRequest.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApprovalApiException(_extractError(e));
    }
  }

  Future<ApprovalQueueStats> queueStats() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/approvals/queue-stats');
      return ApprovalQueueStats.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApprovalApiException(_extractError(e));
    }
  }

  Future<ApprovalRequest> approve(String id, {String? note}) => _decide(id, 'approve', note);

  Future<ApprovalRequest> reject(String id, {String? note}) => _decide(id, 'reject', note);

  Future<ApprovalRequest> requestChanges(String id, {String? note}) =>
      _decide(id, 'request-changes', note);

  Future<ApprovalRequest> cancel(String id, {String? note}) => _decide(id, 'cancel', note);

  Future<ApprovalRequest> _decide(String id, String action, String? note) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/approvals/$id/$action',
        data: {if (note != null && note.isNotEmpty) 'note': note},
      );
      return ApprovalRequest.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApprovalApiException(_extractError(e));
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

final Provider<ApprovalsRepository> approvalsRepositoryProvider = Provider<ApprovalsRepository>(
  (ref) => ApprovalsRepository(ref.watch(apiClientProvider)),
);
