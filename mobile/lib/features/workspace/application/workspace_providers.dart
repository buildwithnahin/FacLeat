import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/company.dart';

/// Companies visible to this superadmin — a small, rarely-changing list
/// (`GET /companies`), so a plain [FutureProvider] (no pagination) is enough.
final FutureProvider<List<Company>> companiesProvider = FutureProvider<List<Company>>((ref) async {
  final dio = ref.watch(apiClientProvider);
  final response = await dio.get<Map<String, dynamic>>('/companies');
  final data = response.data!['data'] as List<dynamic>;
  return data.map((e) => Company.fromJson(e as Map<String, dynamic>)).toList();
});
