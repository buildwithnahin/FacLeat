import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/theme/app_colors.dart';
import '../../reports/application/report_provider.dart' show formatIsoDate;
import '../application/branch_monitoring_providers.dart';
import '../domain/branch_metrics.dart';

/// Superadmin comparison dashboard — every branch's key metrics side by
/// side, so an admin can spot which branch is over/underperforming at a
/// glance. Absorbs the old [BranchesScreen]'s "list every branch" job via
/// the switcher strip at the top, while adding the actual comparison value
/// (bar chart + expandable detail cards) below it.
///
/// Sibling of [ReportDetailScreen]: same date-range filter bar shape, same
/// stat-chip/chart-then-table rhythm, just comparing branches instead of
/// report rows.
class BranchMonitoringScreen extends ConsumerWidget {
  const BranchMonitoringScreen({super.key});

  Future<void> _pickRange(BuildContext context, WidgetRef ref, BranchMonitoringRange current) async {
    final result = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      initialDateRange:
          current.from != null && current.to != null ? DateTimeRange(start: current.from!, end: current.to!) : null,
    );
    if (result != null) {
      ref.read(branchMonitoringRangeProvider.notifier).state =
          BranchMonitoringRange(from: result.start, to: result.end);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final range = ref.watch(branchMonitoringRangeProvider);
    final metricsAsync = ref.watch(branchMonitoringProvider);
    final focusedId = ref.watch(focusedBranchIdProvider);

    final rangeLabel = range.from != null && range.to != null
        ? '${formatIsoDate(range.from!)} → ${formatIsoDate(range.to!)}'
        : 'All time';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Branch Monitoring'),
        actions: [
          if (range.isSet)
            IconButton(
              key: const Key('branchMonitoringClearRangeButton'),
              tooltip: 'Clear date filter',
              icon: const Icon(Icons.close),
              onPressed: () => ref.read(branchMonitoringRangeProvider.notifier).state = const BranchMonitoringRange(),
            ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            child: OutlinedButton.icon(
              key: const Key('branchMonitoringDateFilterButton'),
              onPressed: () => _pickRange(context, ref, range),
              icon: const Icon(Icons.calendar_month_outlined, size: 18),
              label: Text(rangeLabel, overflow: TextOverflow.ellipsis, maxLines: 1),
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(branchMonitoringProvider);
                await ref.read(branchMonitoringProvider.future);
              },
              child: metricsAsync.when(
                data: (metrics) {
                  if (metrics.isEmpty) return const _EmptyState();
                  return ListView(
                    key: const Key('branchMonitoringList'),
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                    children: [
                      _BranchSwitcherStrip(metrics: metrics, focusedId: focusedId),
                      const SizedBox(height: 24),
                      Text(
                        'Sales comparison',
                        style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 10),
                      _SalesBarChart(metrics: metrics, focusedId: focusedId),
                      const SizedBox(height: 24),
                      Text(
                        'Branch details',
                        style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Tap a branch to see its full metric breakdown',
                        style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                      ),
                      const SizedBox(height: 10),
                      for (var i = 0; i < metrics.length; i++) ...[
                        _BranchMetricsCard(
                          metrics: metrics[i],
                          focused: metrics[i].branchId == focusedId,
                          index: i,
                        ),
                        const SizedBox(height: 10),
                      ],
                    ],
                  );
                },
                loading: () => const _MonitoringShimmer(),
                error: (error, stackTrace) => _ErrorState(
                  message: '$error',
                  onRetry: () => ref.invalidate(branchMonitoringProvider),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Horizontally-scrolling strip of every branch (plus a leading "All
/// branches" chip), mirroring `_BranchesStrip` on the home dashboard but
/// selectable — tapping a chip focuses that branch across the comparison
/// view below.
class _BranchSwitcherStrip extends ConsumerWidget {
  const _BranchSwitcherStrip({required this.metrics, required this.focusedId});

  final List<BranchMetrics> metrics;
  final String? focusedId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SizedBox(
      key: const Key('branchSwitcherStrip'),
      height: 92,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: metrics.length + 1,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          if (index == 0) {
            return _SwitcherChip(
              key: const Key('branchSwitcherAllChip'),
              label: 'All branches',
              code: '${metrics.length} total',
              icon: Icons.apps_outlined,
              selected: focusedId == null,
              onTap: () => ref.read(focusedBranchIdProvider.notifier).state = null,
            ).animate().fadeIn(duration: 300.ms).slideX(begin: 0.1, end: 0, duration: 300.ms);
          }
          final branch = metrics[index - 1];
          final selected = branch.branchId == focusedId;
          return _SwitcherChip(
            key: Key('branchSwitcherChip_${branch.branchId}'),
            label: branch.branchName,
            code: branch.branchCode.isNotEmpty ? branch.branchCode : 'No code',
            icon: Icons.store_mall_directory_outlined,
            selected: selected,
            onTap: () => ref.read(focusedBranchIdProvider.notifier).state = selected ? null : branch.branchId,
          ).animate().fadeIn(delay: (index * 50).ms, duration: 300.ms).slideX(begin: 0.1, end: 0, duration: 300.ms);
        },
      ),
    );
  }
}

class _SwitcherChip extends StatelessWidget {
  const _SwitcherChip({
    super.key,
    required this.label,
    required this.code,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String code;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: selected ? AppColors.primary.withValues(alpha: 0.1) : (theme.cardTheme.color ?? theme.colorScheme.surface),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: 142,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected ? AppColors.primary : theme.dividerColor.withValues(alpha: 0.5),
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(icon, size: 15, color: AppColors.primary),
                  ),
                  const Spacer(),
                  if (selected) const Icon(Icons.check_circle, size: 16, color: AppColors.primary),
                ],
              ),
              const Spacer(),
              Text(
                label,
                style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                code,
                style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One bar per branch for `salesGross` — the headline comparison metric.
/// Branches with all-zero activity simply render a zero-height bar (a valid
/// real value, not an error); `maxY` falls back to `1` so an all-zero chart
/// never degenerates to a divide-by-zero / invisible axis.
class _SalesBarChart extends StatelessWidget {
  const _SalesBarChart({required this.metrics, required this.focusedId});

  final List<BranchMetrics> metrics;
  final String? focusedId;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final maxValue = metrics.map((m) => m.salesGross).fold<double>(0, (a, b) => a > b ? a : b);
    final chartWidth = metrics.length * 68.0 < 280.0 ? 280.0 : metrics.length * 68.0;

    return Container(
      key: const Key('branchSalesBarChart'),
      height: 240,
      padding: const EdgeInsets.fromLTRB(4, 16, 12, 8),
      decoration: BoxDecoration(
        color: theme.cardTheme.color ?? theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: SizedBox(
          width: chartWidth,
          child: BarChart(
            BarChartData(
              maxY: maxValue <= 0 ? 1 : maxValue * 1.2,
              barGroups: [
                for (var i = 0; i < metrics.length; i++)
                  BarChartGroupData(
                    x: i,
                    barRods: [
                      BarChartRodData(
                        toY: metrics[i].salesGross,
                        color: metrics[i].branchId == focusedId
                            ? AppColors.warning
                            : (focusedId == null ? AppColors.primary : AppColors.primary.withValues(alpha: 0.3)),
                        width: 22,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ],
                  ),
              ],
              gridData: const FlGridData(show: true, drawVerticalLine: false),
              borderData: FlBorderData(show: false),
              titlesData: FlTitlesData(
                topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 36,
                    getTitlesWidget: (value, meta) {
                      final index = value.toInt();
                      if (index < 0 || index >= metrics.length) return const SizedBox.shrink();
                      final label =
                          metrics[index].branchCode.isNotEmpty ? metrics[index].branchCode : metrics[index].branchName;
                      final short = label.length > 8 ? '${label.substring(0, 8)}…' : label;
                      return Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(short, style: theme.textTheme.bodySmall),
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ).animate().fadeIn(duration: 350.ms);
  }
}

/// One branch's headline sales figure plus quick-glance badges; tapping
/// toggles this branch as the [focusedBranchIdProvider] selection — which
/// both highlights it in [_SalesBarChart] / [_BranchSwitcherStrip] and
/// expands this card in place to reveal the full metric grid.
class _BranchMetricsCard extends ConsumerWidget {
  const _BranchMetricsCard({required this.metrics, required this.focused, required this.index});

  final BranchMetrics metrics;
  final bool focused;
  final int index;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final formatter = NumberFormat.decimalPattern();

    return Material(
      key: Key('branchMetricsCard_${metrics.branchId}'),
      color: theme.cardTheme.color ?? theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        key: Key('branchMetricsCardTap_${metrics.branchId}'),
        onTap: () => ref.read(focusedBranchIdProvider.notifier).state = focused ? null : metrics.branchId,
        borderRadius: BorderRadius.circular(16),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: focused ? AppColors.primary : theme.dividerColor.withValues(alpha: 0.5),
              width: focused ? 1.5 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.store_mall_directory_outlined, size: 18, color: AppColors.primary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          metrics.branchName,
                          style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          metrics.branchCode.isNotEmpty ? metrics.branchCode : 'No code',
                          style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        formatter.format(metrics.salesGross),
                        style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        'Sales',
                        style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                      ),
                    ],
                  ),
                  AnimatedRotation(
                    turns: focused ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(Icons.expand_more, size: 20, color: theme.colorScheme.onSurfaceVariant),
                  ),
                ],
              ),
              if (metrics.hasNoActivity) ...[
                const SizedBox(height: 8),
                Text(
                  'No activity in this period',
                  style: theme.textTheme.labelSmall
                      ?.copyWith(color: theme.colorScheme.onSurfaceVariant, fontStyle: FontStyle.italic),
                ),
              ] else if (metrics.pendingApprovals > 0 || metrics.lowStockProducts > 0) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    if (metrics.pendingApprovals > 0)
                      _MiniBadge(label: '${metrics.pendingApprovals} pending approvals', color: AppColors.warning),
                    if (metrics.lowStockProducts > 0)
                      _MiniBadge(label: '${metrics.lowStockProducts} low stock', color: AppColors.danger),
                  ],
                ),
              ],
              AnimatedCrossFade(
                duration: const Duration(milliseconds: 220),
                crossFadeState: focused ? CrossFadeState.showSecond : CrossFadeState.showFirst,
                firstChild: const SizedBox(width: double.infinity, height: 0),
                secondChild: Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Divider(height: 1),
                      const SizedBox(height: 12),
                      _MetricGrid(metrics: metrics, formatter: formatter),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    )
        .animate(delay: (index * 40).ms)
        .fadeIn(duration: 280.ms, curve: Curves.easeOut)
        .slideY(begin: 0.08, end: 0, duration: 280.ms, curve: Curves.easeOut);
  }
}

class _MiniBadge extends StatelessWidget {
  const _MiniBadge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
    );
  }
}

/// The full 8-metric breakdown shown once a branch card is expanded.
class _MetricGrid extends StatelessWidget {
  const _MetricGrid({required this.metrics, required this.formatter});

  final BranchMetrics metrics;
  final NumberFormat formatter;

  @override
  Widget build(BuildContext context) {
    final items = <(String, String)>[
      ('Sales count', formatter.format(metrics.salesCount)),
      ('Sales outstanding', formatter.format(metrics.salesOutstanding)),
      ('Purchase total', formatter.format(metrics.purchaseTotal)),
      ('Purchase outstanding', formatter.format(metrics.purchaseOutstanding)),
      ('Inventory value', formatter.format(metrics.inventoryValue)),
      ('Active products', formatter.format(metrics.activeProducts)),
      ('Pending approvals', formatter.format(metrics.pendingApprovals)),
      ('Low stock products', formatter.format(metrics.lowStockProducts)),
    ];

    return GridView.builder(
      key: Key('branchMetricGrid_${metrics.branchId}'),
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: items.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 2.6,
      ),
      itemBuilder: (context, index) {
        final theme = Theme.of(context);
        final (label, value) = items[index];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              value,
              style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              label,
              style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        );
      },
    );
  }
}

class _MonitoringShimmer extends StatelessWidget {
  const _MonitoringShimmer();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = theme.colorScheme.surfaceContainerHighest;
    final highlight = theme.colorScheme.surface;

    return ListView(
      key: const Key('branchMonitoringShimmer'),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        Shimmer.fromColors(
          baseColor: base,
          highlightColor: highlight,
          child: SizedBox(
            height: 92,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: 4,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (context, index) => Container(
                width: 142,
                decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ),
        ),
        const SizedBox(height: 24),
        Shimmer.fromColors(
          baseColor: base,
          highlightColor: highlight,
          child: Container(
            height: 240,
            decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(16)),
          ),
        ),
        const SizedBox(height: 24),
        for (var i = 0; i < 3; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Shimmer.fromColors(
              baseColor: base,
              highlightColor: highlight,
              child: Container(
                height: 96,
                decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ),
      ],
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      children: [
        const SizedBox(height: 80),
        Icon(Icons.error_outline, size: 40, color: AppColors.danger),
        const SizedBox(height: 12),
        Center(
          child: Text('Could not load branch comparison', style: theme.textTheme.titleSmall),
        ),
        Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Center(
          child: OutlinedButton.icon(
            key: const Key('branchMonitoringRetryButton'),
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ),
      ],
    );
  }
}

/// Defensive fallback for an empty `data: []` — not expected in practice
/// (there's always at least one branch) but handled gracefully anyway.
class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 80),
          child: Column(
            children: [
              Icon(Icons.store_mall_directory_outlined, size: 40, color: theme.colorScheme.onSurfaceVariant),
              const SizedBox(height: 12),
              Text('No branches found', style: theme.textTheme.bodyMedium),
            ],
          ),
        ),
      ],
    );
  }
}
