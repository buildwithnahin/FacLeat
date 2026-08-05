import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../reports/application/report_provider.dart' show formatIsoDate;
import '../domain/branch_metrics.dart';

/// A user-facing error surfaced by the branch-monitoring API, per the
/// pattern in [ApprovalApiException] — carries the server's own message.
class BranchMonitoringApiException implements Exception {
  const BranchMonitoringApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class BranchMonitoringRepository {
  BranchMonitoringRepository(this._dio);

  final Dio _dio;

  /// Fetches every branch's comparison metrics for the optional
  /// `[from, to]` window. Both bounds are optional independently; omitting
  /// both requests all-time totals. Sorted by branch name server-side.
  Future<List<BranchMetrics>> comparison({DateTime? from, DateTime? to}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/branches/comparison',
        queryParameters: {
          if (from != null) 'from': formatIsoDate(from),
          if (to != null) 'to': formatIsoDate(to),
        },
      );
      final data = response.data!['data'] as List<dynamic>? ?? const [];
      return data.map((e) => BranchMetrics.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw BranchMonitoringApiException(_extractError(e));
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

final Provider<BranchMonitoringRepository> branchMonitoringRepositoryProvider =
    Provider<BranchMonitoringRepository>(
  (ref) => BranchMonitoringRepository(ref.watch(apiClientProvider)),
);
