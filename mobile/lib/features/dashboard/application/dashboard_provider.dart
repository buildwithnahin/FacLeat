import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../audit/domain/audit_entry.dart';

/// Super-admin dashboard KPI snapshot, as returned by `GET /dashboard`.
///
/// Numeric fields default to 0 when absent rather than throwing, since a
/// freshly-provisioned tenant may not populate every metric yet.
class DashboardSummary extends Equatable {
  const DashboardSummary({
    required this.totalCompanies,
    required this.totalBranches,
    required this.totalUsers,
    required this.activeModules,
    required this.systemHealth,
    required this.todayLoginUsers,
    required this.pendingApprovals,
    required this.lowStockProducts,
    required this.activeProducts,
    required this.totalSales,
    required this.totalPurchases,
    required this.revenue,
    required this.outstandingPayments,
    required this.pendingOrders,
    required this.employeeAttendance,
  });

  factory DashboardSummary.fromJson(Map<String, dynamic> json) => DashboardSummary(
        totalCompanies: _asInt(json['totalCompanies']),
        totalBranches: _asInt(json['totalBranches']),
        totalUsers: _asInt(json['totalUsers']),
        activeModules: _asInt(json['activeModules']),
        systemHealth: json['systemHealth'] as String? ?? 'Unknown',
        todayLoginUsers: _asInt(json['todayLoginUsers']),
        pendingApprovals: _asInt(json['pendingApprovals']),
        lowStockProducts: _asInt(json['lowStockProducts']),
        activeProducts: _asInt(json['activeProducts']),
        totalSales: _asDouble(json['totalSales']),
        totalPurchases: _asDouble(json['totalPurchases']),
        revenue: _asDouble(json['revenue']),
        outstandingPayments: _asDouble(json['outstandingPayments']),
        pendingOrders: _asInt(json['pendingOrders']),
        employeeAttendance: json['employeeAttendance'] == null ? null : _asDouble(json['employeeAttendance']),
      );

  final int totalCompanies;
  final int totalBranches;
  final int totalUsers;
  final int activeModules;
  final String systemHealth;
  final int todayLoginUsers;
  final int pendingApprovals;
  final int lowStockProducts;
  final int activeProducts;
  final double totalSales;
  final double totalPurchases;
  final double revenue;
  final double outstandingPayments;
  final int pendingOrders;
  /// Percentage (0-100) of active employees present today, or `null` when
  /// there are zero active employees to measure — matches the backend's
  /// own null-when-no-denominator contract, don't coerce to 0.
  final double? employeeAttendance;

  static int _asInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is num) return value.round();
    return int.tryParse(value.toString()) ?? 0;
  }

  static double _asDouble(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0;
  }

  @override
  List<Object?> get props => [
        totalCompanies,
        totalBranches,
        totalUsers,
        activeModules,
        systemHealth,
        todayLoginUsers,
        pendingApprovals,
        lowStockProducts,
        activeProducts,
        totalSales,
        totalPurchases,
        revenue,
        outstandingPayments,
        pendingOrders,
        employeeAttendance,
      ];
}

final FutureProvider<DashboardSummary> dashboardProvider =
    FutureProvider<DashboardSummary>((ref) async {
  final dio = ref.watch(apiClientProvider);
  final response = await dio.get<Map<String, dynamic>>('/dashboard');
  final data = response.data!['data'] as Map<String, dynamic>;
  return DashboardSummary.fromJson(data);
});

/// A small, independent slice of the audit feed for the dashboard's
/// "Recent activity" widget — deliberately not sharing state with
/// [auditListProvider]'s paginated notifier, since that one belongs to the
/// full Audit Log screen's own scroll position and filters.
final FutureProvider<List<AuditEntry>> recentActivityProvider =
    FutureProvider<List<AuditEntry>>((ref) async {
  final dio = ref.watch(apiClientProvider);
  final response = await dio.get<Map<String, dynamic>>(
    '/audit',
    queryParameters: {'limit': 5, 'offset': 0},
  );
  final data = response.data!['data'] as Map<String, dynamic>;
  final rows = (data['rows'] as List<dynamic>)
      .map((e) => AuditEntry.fromJson(Map<String, dynamic>.from(e as Map)))
      .toList();
  return rows;
});
