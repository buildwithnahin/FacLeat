import 'package:csv/csv.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/theme/app_colors.dart';
import '../application/report_provider.dart';
import '../domain/report_data.dart';

/// Financial report types that are point-in-time snapshots (`asOf`) rather
/// than date-range reports (`from`/`to`). Confirmed against the live API —
/// every other financials type accepts a range.
const _asOfFinancialTypes = {'trial-balance', 'balance-sheet', 'notes'};

/// One generic report viewer reused by `/reports/general/:type`,
/// `/reports/financials/:type`, and `/reports/hr/:category/:type` — the
/// backend returns a different JSON shape per report, so this screen
/// normalizes via [parseReportPayload] rather than hand-building per-type UI.
class ReportDetailScreen extends ConsumerStatefulWidget {
  const ReportDetailScreen({
    super.key,
    required this.family,
    required this.type,
    this.category,
    required this.title,
  });

  final ReportFamily family;
  final String type;
  final String? category;
  final String title;

  bool get usesAsOf => family == ReportFamily.financials && _asOfFinancialTypes.contains(type);

  @override
  ConsumerState<ReportDetailScreen> createState() => _ReportDetailScreenState();
}

class _ReportDetailScreenState extends ConsumerState<ReportDetailScreen> {
  late ReportRequest _request;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _request = ReportRequest(
      family: widget.family,
      type: widget.type,
      category: widget.category,
      from: widget.usesAsOf ? null : DateTime(now.year, now.month, 1),
      to: widget.usesAsOf ? null : now,
      asOf: widget.usesAsOf ? now : null,
    );
  }

  Future<void> _pickRange() async {
    final result = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      initialDateRange: _request.from != null && _request.to != null
          ? DateTimeRange(start: _request.from!, end: _request.to!)
          : null,
    );
    if (result != null) {
      setState(() => _request = _request.copyWith(from: result.start, to: result.end));
    }
  }

  Future<void> _pickAsOf() async {
    final result = await showDatePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      initialDate: _request.asOf ?? DateTime.now(),
    );
    if (result != null) {
      setState(() => _request = _request.copyWith(asOf: result));
    }
  }

  Future<void> _exportCsv(List<ReportSection> sections) async {
    if (sections.isEmpty) return;
    final section = sections.firstWhere((s) => !s.isEmpty, orElse: () => sections.first);
    final rows = <List<dynamic>>[section.columns, ...section.rows];
    final csv = Csv().encode(rows);
    await SharePlus.instance.share(
      ShareParams(text: csv, subject: '${widget.title} export'),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final payloadAsync = ref.watch(reportPayloadProvider(_request));
    final branchesAsync = ref.watch(branchesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          payloadAsync.maybeWhen(
            data: (data) => IconButton(
              key: const Key('exportCsvButton'),
              tooltip: 'Export CSV',
              icon: const Icon(Icons.ios_share),
              onPressed: () => _exportCsv(parseReportPayload(data)),
            ),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: Column(
        children: [
          _FilterBar(
            request: _request,
            usesAsOf: widget.usesAsOf,
            branchesAsync: branchesAsync,
            onPickDate: widget.usesAsOf ? _pickAsOf : _pickRange,
            onBranchChanged: (branchId) => setState(
              () => _request = branchId == null
                  ? _request.copyWith(clearBranch: true)
                  : _request.copyWith(branchId: branchId),
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(reportPayloadProvider(_request));
                await ref.read(reportPayloadProvider(_request).future);
              },
              child: payloadAsync.when(
                data: (data) {
                  final sections = parseReportPayload(data);
                  if (sections.isEmpty || sections.every((s) => s.isEmpty)) {
                    return _EmptyState(scrollable: true);
                  }
                  return _ReportBody(sections: sections);
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, stackTrace) => ListView(
                  children: [
                    const SizedBox(height: 80),
                    Icon(Icons.error_outline, size: 40, color: AppColors.danger),
                    const SizedBox(height: 12),
                    Center(
                      child: Text(
                        'Failed to load report',
                        style: theme.textTheme.titleSmall,
                      ),
                    ),
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Text(
                          '$error',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Center(
                      child: OutlinedButton.icon(
                        onPressed: () => ref.invalidate(reportPayloadProvider(_request)),
                        icon: const Icon(Icons.refresh),
                        label: const Text('Retry'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({
    required this.request,
    required this.usesAsOf,
    required this.branchesAsync,
    required this.onPickDate,
    required this.onBranchChanged,
  });

  final ReportRequest request;
  final bool usesAsOf;
  final AsyncValue<List<BranchOption>> branchesAsync;
  final VoidCallback onPickDate;
  final ValueChanged<String?> onBranchChanged;

  String get _dateLabel {
    if (usesAsOf) {
      return request.asOf != null ? 'As of ${formatIsoDate(request.asOf!)}' : 'Pick date';
    }
    if (request.from != null && request.to != null) {
      return '${formatIsoDate(request.from!)} → ${formatIsoDate(request.to!)}';
    }
    return 'Pick date range';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              key: const Key('reportDateFilterButton'),
              onPressed: onPickDate,
              icon: const Icon(Icons.calendar_month_outlined, size: 18),
              label: Text(_dateLabel, overflow: TextOverflow.ellipsis, maxLines: 1),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: branchesAsync.when(
              data: (branches) => DropdownButtonFormField<String>(
                key: const Key('reportBranchFilterDropdown'),
                initialValue: request.branchId,
                isExpanded: true,
                decoration: const InputDecoration(
                  isDense: true,
                  prefixIcon: Icon(Icons.store_outlined, size: 18),
                ),
                hint: const Text('All branches'),
                items: [
                  const DropdownMenuItem(value: null, child: Text('All branches')),
                  ...branches.map(
                    (b) => DropdownMenuItem(value: b.id, child: Text(b.name, overflow: TextOverflow.ellipsis)),
                  ),
                ],
                onChanged: onBranchChanged,
              ),
              loading: () => const SizedBox(height: 40),
              error: (_, _) => const SizedBox.shrink(),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReportBody extends StatelessWidget {
  const _ReportBody({required this.sections});

  final List<ReportSection> sections;

  @override
  Widget build(BuildContext context) {
    final chartable = findChartableSection(sections);

    return ListView(
      key: const Key('reportBodyList'),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        if (chartable != null) ...[
          _StatsRow(section: chartable.section, columns: chartable.columns),
          const SizedBox(height: 20),
          _ReportInsightCard(section: chartable.section, columns: chartable.columns),
          const SizedBox(height: 20),
          _ReportChart(section: chartable.section, columns: chartable.columns),
          const SizedBox(height: 20),
          _ReportPieChart(section: chartable.section, columns: chartable.columns),
          const SizedBox(height: 20),
        ],
        for (final section in sections)
          if (!section.isEmpty) ...[
            _ReportTable(section: section),
            const SizedBox(height: 20),
          ],
      ],
    );
  }
}

/// Three quick-glance stat chips (row count, total, average) computed
/// generically from whichever section+column [findChartableSection] picked
/// — no per-report-type bespoke logic needed.
class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.section, required this.columns});

  final ReportSection section;
  final ChartableColumn columns;

  List<double> get _values => section.rows
      .map((r) => double.tryParse(r[columns.valueIndex].replaceAll(',', '')) ?? 0)
      .toList();

  @override
  Widget build(BuildContext context) {
    final values = _values;
    final total = values.fold<double>(0, (a, b) => a + b);
    final average = values.isEmpty ? 0.0 : total / values.length;
    final formatter = NumberFormat.decimalPattern();

    final stats = [
      (label: 'Rows', value: values.length.toString(), icon: Icons.table_rows_outlined, color: AppColors.primary),
      (label: 'Total', value: formatter.format(total), icon: Icons.summarize_outlined, color: AppColors.success),
      (label: 'Average', value: formatter.format(average), icon: Icons.trending_up, color: AppColors.warning),
    ];

    return Row(
      key: const Key('reportStatsRow'),
      children: [
        for (var i = 0; i < stats.length; i++) ...[
          if (i > 0) const SizedBox(width: 10),
          Expanded(child: _StatChip(spec: stats[i])),
        ],
      ],
    ).animate().fadeIn(duration: 300.ms).slideY(begin: 0.08, end: 0, duration: 300.ms);
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.spec});

  final ({String label, String value, IconData icon, Color color}) spec;

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
          Icon(spec.icon, size: 16, color: spec.color),
          const SizedBox(height: 8),
          Text(
            spec.value,
            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
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

/// Highlights the single highest-value row — a quick "what stands out"
/// callout, generically derived from the same chartable column.
class _ReportInsightCard extends StatelessWidget {
  const _ReportInsightCard({required this.section, required this.columns});

  final ReportSection section;
  final ChartableColumn columns;

  @override
  Widget build(BuildContext context) {
    if (section.rows.isEmpty) return const SizedBox.shrink();
    final theme = Theme.of(context);

    var topRow = section.rows.first;
    var topValue = double.tryParse(topRow[columns.valueIndex].replaceAll(',', '')) ?? 0;
    for (final row in section.rows) {
      final v = double.tryParse(row[columns.valueIndex].replaceAll(',', '')) ?? 0;
      if (v > topValue) {
        topValue = v;
        topRow = row;
      }
    }
    final label = columns.labelIndex < topRow.length ? topRow[columns.labelIndex] : '—';
    final formatter = NumberFormat.decimalPattern();

    return Container(
      key: const Key('reportInsightCard'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary.withValues(alpha: 0.14), AppColors.primary.withValues(alpha: 0.03)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          const Icon(Icons.emoji_events_outlined, color: AppColors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Top: $label',
                  style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  '${section.columns[columns.valueIndex]}: ${formatter.format(topValue)}',
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 320.ms);
  }
}

class _ReportChart extends StatelessWidget {
  const _ReportChart({required this.section, required this.columns});

  final ReportSection section;
  final ChartableColumn columns;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final topRows = [...section.rows]
      ..sort((a, b) {
        final av = double.tryParse(a[columns.valueIndex].replaceAll(',', '')) ?? 0;
        final bv = double.tryParse(b[columns.valueIndex].replaceAll(',', '')) ?? 0;
        return bv.compareTo(av);
      });
    final chartRows = topRows.take(8).toList();
    if (chartRows.isEmpty) return const SizedBox.shrink();

    final maxValue = chartRows
        .map((r) => double.tryParse(r[columns.valueIndex].replaceAll(',', '')) ?? 0)
        .fold<double>(0, (a, b) => a > b ? a : b);

    return Container(
      key: const Key('reportChart'),
      height: 240,
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 8),
      decoration: BoxDecoration(
        color: theme.cardTheme.color ?? theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
      ),
      child: BarChart(
        BarChartData(
          maxY: maxValue <= 0 ? 1 : maxValue * 1.2,
          barGroups: [
            for (var i = 0; i < chartRows.length; i++)
              BarChartGroupData(
                x: i,
                barRods: [
                  BarChartRodData(
                    toY: double.tryParse(chartRows[i][columns.valueIndex].replaceAll(',', '')) ?? 0,
                    color: AppColors.primary,
                    width: 16,
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
                  if (index < 0 || index >= chartRows.length) return const SizedBox.shrink();
                  final label = chartRows[index][columns.labelIndex];
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
    ).animate().fadeIn(duration: 350.ms);
  }
}

/// Top-5-vs-rest donut breakdown of the same chartable column — a second,
/// differently-shaped view of the data alongside the bar chart above.
class _ReportPieChart extends StatelessWidget {
  const _ReportPieChart({required this.section, required this.columns});

  final ReportSection section;
  final ChartableColumn columns;

  static const _sliceColors = [
    AppColors.primary,
    AppColors.success,
    AppColors.warning,
    AppColors.danger,
    Color(0xFF8B5CF6),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ranked = [...section.rows]
      ..sort((a, b) {
        final av = double.tryParse(a[columns.valueIndex].replaceAll(',', '')) ?? 0;
        final bv = double.tryParse(b[columns.valueIndex].replaceAll(',', '')) ?? 0;
        return bv.compareTo(av);
      });

    final top = ranked.take(5).toList();
    final topValues = top
        .map((r) => double.tryParse(r[columns.valueIndex].replaceAll(',', '')) ?? 0)
        .toList();
    final topSum = topValues.fold<double>(0, (a, b) => a + b);
    final grandTotal = ranked
        .map((r) => double.tryParse(r[columns.valueIndex].replaceAll(',', '')) ?? 0)
        .fold<double>(0, (a, b) => a + b);
    final restValue = (grandTotal - topSum).clamp(0, double.infinity);

    final slices = <({String label, double value, Color color})>[
      for (var i = 0; i < top.length; i++)
        (
          label: columns.labelIndex < top[i].length ? top[i][columns.labelIndex] : '—',
          value: topValues[i],
          color: _sliceColors[i % _sliceColors.length],
        ),
      if (restValue > 0) (label: 'Other', value: restValue.toDouble(), color: theme.colorScheme.outlineVariant),
    ];

    if (slices.every((s) => s.value <= 0)) return const SizedBox.shrink();

    return Container(
      key: const Key('reportPieChart'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardTheme.color ?? theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 120,
            height: 120,
            child: PieChart(
              PieChartData(
                sectionsSpace: 2,
                centerSpaceRadius: 28,
                sections: [
                  for (final s in slices)
                    PieChartSectionData(
                      value: s.value <= 0 ? 0.001 : s.value,
                      color: s.color,
                      radius: 22,
                      showTitle: false,
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final s in slices)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      children: [
                        Container(width: 8, height: 8, decoration: BoxDecoration(color: s.color, shape: BoxShape.circle)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            s.label,
                            style: theme.textTheme.bodySmall,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 380.ms);
  }
}

class _ReportTable extends StatelessWidget {
  const _ReportTable({required this.section});

  final ReportSection section;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(section.title, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: theme.cardTheme.color ?? theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
          ),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              key: Key('reportTable_${section.title}'),
              columns: section.columns.map((c) => DataColumn(label: Text(c))).toList(),
              rows: section.rows
                  .map(
                    (row) => DataRow(
                      cells: [
                        for (var i = 0; i < section.columns.length; i++)
                          DataCell(Text(i < row.length ? row[i] : '—')),
                      ],
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
      ],
    ).animate().fadeIn(duration: 350.ms);
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({this.scrollable = false});

  final bool scrollable;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final content = Padding(
      padding: const EdgeInsets.symmetric(vertical: 80),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.inbox_outlined, size: 40, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(height: 12),
          Text('No data for the selected filters', style: theme.textTheme.bodyMedium),
        ],
      ),
    );
    if (!scrollable) return Center(child: content);
    return ListView(children: [content]);
  }
}
