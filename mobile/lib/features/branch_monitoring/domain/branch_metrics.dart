import 'package:equatable/equatable.dart';

/// One branch's aggregated KPI snapshot, as returned by
/// `GET /branches/comparison`. Unlike the global-search endpoint, every
/// numeric field here arrives as a plain JSON number rather than a
/// stringified decimal — still parsed defensively in case of nulls.
class BranchMetrics extends Equatable {
  const BranchMetrics({
    required this.branchId,
    required this.branchName,
    required this.branchCode,
    this.salesGross = 0,
    this.salesCount = 0,
    this.salesOutstanding = 0,
    this.purchaseTotal = 0,
    this.purchaseOutstanding = 0,
    this.inventoryValue = 0,
    this.pendingApprovals = 0,
    this.lowStockProducts = 0,
    this.activeProducts = 0,
  });

  factory BranchMetrics.fromJson(Map<String, dynamic> json) => BranchMetrics(
        branchId: json['branchId'] as String? ?? '',
        branchName: json['branchName'] as String? ?? 'Unknown branch',
        branchCode: json['branchCode'] as String? ?? '',
        salesGross: (json['salesGross'] as num?)?.toDouble() ?? 0,
        salesCount: (json['salesCount'] as num?)?.toInt() ?? 0,
        salesOutstanding: (json['salesOutstanding'] as num?)?.toDouble() ?? 0,
        purchaseTotal: (json['purchaseTotal'] as num?)?.toDouble() ?? 0,
        purchaseOutstanding: (json['purchaseOutstanding'] as num?)?.toDouble() ?? 0,
        inventoryValue: (json['inventoryValue'] as num?)?.toDouble() ?? 0,
        pendingApprovals: (json['pendingApprovals'] as num?)?.toInt() ?? 0,
        lowStockProducts: (json['lowStockProducts'] as num?)?.toInt() ?? 0,
        activeProducts: (json['activeProducts'] as num?)?.toInt() ?? 0,
      );

  final String branchId;
  final String branchName;
  final String branchCode;
  final double salesGross;
  final int salesCount;
  final double salesOutstanding;
  final double purchaseTotal;
  final double purchaseOutstanding;
  final double inventoryValue;
  final int pendingApprovals;
  final int lowStockProducts;
  final int activeProducts;

  /// True when every metric is zero. A perfectly realistic, valid state for
  /// a quiet branch — not an error — so callers should render it plainly
  /// rather than treating it as missing data.
  bool get hasNoActivity =>
      salesGross == 0 &&
      salesCount == 0 &&
      salesOutstanding == 0 &&
      purchaseTotal == 0 &&
      purchaseOutstanding == 0 &&
      inventoryValue == 0 &&
      pendingApprovals == 0 &&
      lowStockProducts == 0 &&
      activeProducts == 0;

  @override
  List<Object?> get props => [
        branchId,
        branchName,
        branchCode,
        salesGross,
        salesCount,
        salesOutstanding,
        purchaseTotal,
        purchaseOutstanding,
        inventoryValue,
        pendingApprovals,
        lowStockProducts,
        activeProducts,
      ];
}
