import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/router/app_router.dart';
import '../../../core/router/main_shell.dart';
import '../../../core/theme/app_colors.dart';
import '../application/approvals_providers.dart';
import '../data/approvals_repository.dart';
import '../domain/approval_request.dart';

/// Status filter options shown as chips, in display order. `null` = "All".
const List<({String? value, String label})> _statusFilters = [
  (value: null, label: 'All'),
  (value: 'PENDING', label: 'Pending'),
  (value: 'APPROVED', label: 'Approved'),
  (value: 'REJECTED', label: 'Rejected'),
  (value: 'CANCELLED', label: 'Cancelled'),
  (value: 'CHANGES_REQUESTED', label: 'Changes requested'),
  (value: 'ESCALATED', label: 'Escalated'),
];

/// Color for a given approval/step status, matching the app-wide convention:
/// green = healthy/approved, amber = pending/attention, red = rejected/dead.
Color approvalStatusColor(String status) {
  switch (status) {
    case 'APPROVED':
      return AppColors.success;
    case 'REJECTED':
    case 'CANCELLED':
      return AppColors.danger;
    case 'PENDING':
    case 'CHANGES_REQUESTED':
    case 'ESCALATED':
    case 'WAITING':
    case 'ACTIVE':
    case 'SKIPPED':
    default:
      return AppColors.warning;
  }
}

String approvalStatusLabel(String status) {
  switch (status) {
    case 'CHANGES_REQUESTED':
      return 'Changes requested';
    default:
      return status[0] + status.substring(1).toLowerCase();
  }
}

/// The approvals queue — an admin's list of approval requests, filterable by
/// status, with pending/approved/rejected counters up top.
class ApprovalsListScreen extends ConsumerWidget {
  const ApprovalsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final approvalsAsync = ref.watch(approvalsListProvider);
    final statsAsync = ref.watch(approvalQueueStatsProvider);
    final selectedStatus = ref.watch(approvalsStatusFilterProvider);

    return Scaffold(
      appBar: AppBar(
        leading: const DrawerMenuButton(),
        title: const Text('Approvals'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: _QueueStatsRow(statsAsync: statsAsync),
          ),
          SizedBox(
            height: 40,
            child: ListView.separated(
              key: const Key('approvalsStatusFilterList'),
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _statusFilters.length,
              separatorBuilder: (context, index) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final filter = _statusFilters[index];
                final selected = filter.value == selectedStatus;
                return ChoiceChip(
                  key: Key('approvalsStatusFilter_${filter.value ?? 'ALL'}'),
                  label: Text(filter.label),
                  selected: selected,
                  onSelected: (_) =>
                      ref.read(approvalsStatusFilterProvider.notifier).state = filter.value,
                );
              },
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: approvalsAsync.when(
              loading: () => const _ApprovalsListShimmer(),
              error: (error, stackTrace) => _ApprovalsListError(
                onRetry: () => ref.invalidate(approvalsListProvider),
              ),
              data: (requests) {
                if (requests.isEmpty) {
                  return const _EmptyApprovalsState();
                }

                return RefreshIndicator(
                  onRefresh: () {
                    ref.invalidate(approvalQueueStatsProvider);
                    return ref.refresh(approvalsListProvider.future);
                  },
                  child: ListView.builder(
                    key: const Key('approvalsListView'),
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    itemCount: requests.length,
                    itemBuilder: (context, index) {
                      final request = requests[index];
                      return _ApprovalListTile(request: request)
                          .animate(delay: (index * 40).ms)
                          .fadeIn(duration: 280.ms, curve: Curves.easeOut)
                          .slideY(begin: 0.12, end: 0, duration: 280.ms, curve: Curves.easeOut);
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _QueueStatsRow extends StatelessWidget {
  const _QueueStatsRow({required this.statsAsync});

  final AsyncValue<ApprovalQueueStats> statsAsync;

  @override
  Widget build(BuildContext context) {
    final stats = statsAsync.valueOrNull;
    final items = [
      (label: 'Pending', value: stats?.pending, icon: Icons.hourglass_top_outlined, color: AppColors.warning),
      (label: 'Approved', value: stats?.approved, icon: Icons.check_circle_outline, color: AppColors.success),
      (label: 'Rejected', value: stats?.rejected, icon: Icons.cancel_outlined, color: AppColors.danger),
    ];

    return Row(
      key: const Key('approvalsStatsRow'),
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: 10),
          Expanded(child: _StatChip(spec: items[i])),
        ],
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.spec});

  final ({String label, int? value, IconData icon, Color color}) spec;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: spec.color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: spec.color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(spec.icon, size: 18, color: spec.color),
          const SizedBox(height: 8),
          Text(
            spec.value?.toString() ?? '–',
            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: spec.color),
          ),
          Text(
            spec.label,
            style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final color = approvalStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        approvalStatusLabel(status),
        style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 10.5, letterSpacing: 0.3),
      ),
    );
  }
}

class _ApprovalListTile extends StatelessWidget {
  const _ApprovalListTile({required this.request});

  final ApprovalRequest request;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final formatter = DateFormat('yyyy-MM-dd · HH:mm');
    final color = approvalStatusColor(request.status);
    final amountValue = request.amountValue;

    return Card(
      key: Key('approvalCard_${request.id}'),
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        // NOTE: `/approvals/:id` isn't registered in app_router.dart yet —
        // that wiring happens in a later integration step. This literal
        // path matches the convention used by roleDetailPath/userDetailPath
        // so the route will resolve once registered.
        onTap: () => context.push(approvalDetailPath(request.id)),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.fact_check_outlined, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            request.title,
                            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        _StatusBadge(status: request.status),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${request.module} · ${request.action}',
                      style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      [
                        request.requestedBy?.name ?? 'Unknown',
                        if (amountValue != null)
                          '${NumberFormat.decimalPattern().format(amountValue)}${request.currency != null ? ' ${request.currency}' : ''}',
                        formatter.format(request.createdAt),
                      ].join(' · '),
                      style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: theme.colorScheme.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}

class _ApprovalsListShimmer extends StatelessWidget {
  const _ApprovalsListShimmer();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = theme.colorScheme.surfaceContainerHighest;
    final highlight = theme.colorScheme.surface;

    return ListView.builder(
      key: const Key('approvalsListShimmer'),
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      itemCount: 6,
      itemBuilder: (context, index) => Shimmer.fromColors(
        baseColor: base,
        highlightColor: highlight,
        child: Container(
          height: 88,
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: base,
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
    );
  }
}

class _ApprovalsListError extends StatelessWidget {
  const _ApprovalsListError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 40, color: theme.colorScheme.error),
            const SizedBox(height: 12),
            Text('Could not load approvals', style: theme.textTheme.titleMedium),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

class _EmptyApprovalsState extends StatelessWidget {
  const _EmptyApprovalsState();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.fact_check_outlined, size: 40, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(height: 12),
            Text('No approval requests', style: theme.textTheme.titleMedium),
          ],
        ),
      ),
    );
  }
}
