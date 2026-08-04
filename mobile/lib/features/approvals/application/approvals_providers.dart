import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/approvals_repository.dart';
import '../domain/approval_request.dart';

/// Optional status filter applied to [approvalsListProvider]. `null` means
/// "All statuses". Owned by the list screen's filter chips.
final StateProvider<String?> approvalsStatusFilterProvider = StateProvider<String?>((ref) => null);

/// The approval queue for the current filter, per `GET /approvals`.
final FutureProvider<List<ApprovalRequest>> approvalsListProvider =
    FutureProvider<List<ApprovalRequest>>((ref) {
  final status = ref.watch(approvalsStatusFilterProvider);
  return ref.watch(approvalsRepositoryProvider).list(status: status);
});

/// A single approval request by id, per `GET /approvals/:id`. Kept separate
/// from [approvalsListProvider] so the detail screen can refetch the full
/// shape (rule, steps, requestedBy) after a decision without reloading the
/// whole queue.
final FutureProviderFamily<ApprovalRequest, String> approvalDetailProvider =
    FutureProvider.family<ApprovalRequest, String>(
  (ref, id) => ref.watch(approvalsRepositoryProvider).getById(id),
);

/// Pending / approved / rejected counters, per `GET /approvals/queue-stats`.
final FutureProvider<ApprovalQueueStats> approvalQueueStatsProvider =
    FutureProvider<ApprovalQueueStats>(
  (ref) => ref.watch(approvalsRepositoryProvider).queueStats(),
);
