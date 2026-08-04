import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

enum ReportFamily { general, financials, hr }

/// A single branch, as returned by `GET /branches`.
class BranchOption extends Equatable {
  const BranchOption({required this.id, required this.name, required this.code});

  factory BranchOption.fromJson(Map<String, dynamic> json) => BranchOption(
        id: json['id'] as String,
        name: json['name'] as String,
        code: json['code'] as String? ?? '',
      );

  final String id;
  final String name;
  final String code;

  @override
  List<Object?> get props => [id, name, code];
}

final FutureProvider<List<BranchOption>> branchesProvider =
    FutureProvider<List<BranchOption>>((ref) async {
  final dio = ref.watch(apiClientProvider);
  final response = await dio.get<Map<String, dynamic>>('/branches');
  final data = response.data!['data'] as List<dynamic>;
  return data.map((e) => BranchOption.fromJson(e as Map<String, dynamic>)).toList();
});

/// Identifies one report request: which endpoint family, which report
/// type/category, and which filters are applied. Used both as the Riverpod
/// family key and as the immutable filter state held by the detail screen.
class ReportRequest extends Equatable {
  const ReportRequest({
    required this.family,
    required this.type,
    this.category,
    this.branchId,
    this.from,
    this.to,
    this.asOf,
  });

  final ReportFamily family;
  final String type;

  /// Only set for [ReportFamily.hr] — the report category (`payroll`,
  /// `leave`, ...).
  final String? category;
  final String? branchId;
  final DateTime? from;
  final DateTime? to;
  final DateTime? asOf;

  ReportRequest copyWith({
    String? branchId,
    bool clearBranch = false,
    DateTime? from,
    DateTime? to,
    bool clearRange = false,
    DateTime? asOf,
    bool clearAsOf = false,
  }) {
    return ReportRequest(
      family: family,
      type: type,
      category: category,
      branchId: clearBranch ? null : (branchId ?? this.branchId),
      from: clearRange ? null : (from ?? this.from),
      to: clearRange ? null : (to ?? this.to),
      asOf: clearAsOf ? null : (asOf ?? this.asOf),
    );
  }

  String get path {
    switch (family) {
      case ReportFamily.general:
        return '/reports/general/$type';
      case ReportFamily.financials:
        return '/reports/financials/$type';
      case ReportFamily.hr:
        return '/reports/hr/$category/$type';
    }
  }

  @override
  List<Object?> get props => [family, type, category, branchId, from, to, asOf];
}

/// Formats a [DateTime] as `yyyy-MM-dd` without pulling in `package:intl`.
String formatIsoDate(DateTime date) {
  final y = date.year.toString().padLeft(4, '0');
  final m = date.month.toString().padLeft(2, '0');
  final d = date.day.toString().padLeft(2, '0');
  return '$y-$m-$d';
}

/// Fetches the raw JSON payload for a [ReportRequest]. Kept as `dynamic`
/// rather than a typed model since every report shape differs — normalized
/// downstream by `parseReportPayload`.
final reportPayloadProvider =
    FutureProvider.family<dynamic, ReportRequest>((ref, request) async {
  final dio = ref.watch(apiClientProvider);
  final query = <String, dynamic>{};
  if (request.branchId != null) query['branchId'] = request.branchId;
  if (request.from != null) query['from'] = formatIsoDate(request.from!);
  if (request.to != null) query['to'] = formatIsoDate(request.to!);
  if (request.asOf != null) query['asOf'] = formatIsoDate(request.asOf!);

  final response = await dio.get<Map<String, dynamic>>(request.path, queryParameters: query);
  return response.data!['data'];
});
