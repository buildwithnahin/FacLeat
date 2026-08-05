import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/search_result.dart';

/// A user-facing error surfaced by the search API, per the pattern in
/// [ApprovalApiException] / `RoleApiException`.
class SearchApiException implements Exception {
  const SearchApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class SearchRepository {
  SearchRepository(this._dio);

  final Dio _dio;

  /// `GET /search?q=<query>&limit=<limit>`. The backend returns all-empty
  /// category arrays (not an error) for queries shorter than 2 characters,
  /// but callers should avoid firing this at all below that length — see
  /// the debounce + length gate in `search_providers.dart`.
  Future<GlobalSearchResult> search(String query, {int? limit}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/search',
        queryParameters: {
          'q': query,
          'limit': ?limit,
        },
      );
      return GlobalSearchResult.fromJson(response.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw SearchApiException(_extractError(e));
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

final Provider<SearchRepository> searchRepositoryProvider = Provider<SearchRepository>(
  (ref) => SearchRepository(ref.watch(apiClientProvider)),
);
