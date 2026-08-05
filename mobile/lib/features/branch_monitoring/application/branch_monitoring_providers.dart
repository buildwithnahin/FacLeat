import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/branch_monitoring_repository.dart';
import '../domain/branch_metrics.dart';

/// Optional date-range filter for the comparison endpoint. `null` on both
/// ends means "all time" — the same convention as [ReportRequest]'s
/// `from`/`to`, just without the `asOf` / `branchId` fields this screen
/// doesn't need (it always compares every branch at once).
class BranchMonitoringRange extends Equatable {
  const BranchMonitoringRange({this.from, this.to});

  final DateTime? from;
  final DateTime? to;

  bool get isSet => from != null || to != null;

  @override
  List<Object?> get props => [from, to];
}

/// The active date-range filter, owned by the monitoring screen's filter
/// button.
final StateProvider<BranchMonitoringRange> branchMonitoringRangeProvider =
    StateProvider<BranchMonitoringRange>((ref) => const BranchMonitoringRange());

/// All branches' comparison metrics for the current
/// [branchMonitoringRangeProvider], sorted by branch name by the backend.
final FutureProvider<List<BranchMetrics>> branchMonitoringProvider =
    FutureProvider<List<BranchMetrics>>((ref) {
  final range = ref.watch(branchMonitoringRangeProvider);
  return ref.watch(branchMonitoringRepositoryProvider).comparison(from: range.from, to: range.to);
});

/// The branch currently "focused" via the branch-switcher strip (or a tap on
/// its detail card). `null` means no branch is focused — the comparison
/// view treats every branch equally. Tapping the same branch again clears
/// the focus.
final StateProvider<String?> focusedBranchIdProvider = StateProvider<String?>((ref) => null);
