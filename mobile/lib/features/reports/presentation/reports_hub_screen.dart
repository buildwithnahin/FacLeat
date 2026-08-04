import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/router/main_shell.dart';
import '../../../core/theme/app_colors.dart';
import '../data/report_catalog.dart';

/// Categorized entry point into every report the mobile app exposes:
/// General, Financials, and HR (which further drills into a category).
class ReportsHubScreen extends StatelessWidget {
  const ReportsHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: const DrawerMenuButton(), title: const Text('Reports')),
      body: ListView(
        key: const Key('reportsHubList'),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          _CategorySection(
            key: const Key('section_general'),
            title: 'General',
            icon: Icons.bar_chart_outlined,
            color: AppColors.primary,
            children: generalReports
                .map((r) => _ReportTile(
                      label: r.label,
                      onTap: () => context.go(reportsGeneralPath(r.type)),
                    ))
                .toList(),
          ),
          const SizedBox(height: 20),
          _CategorySection(
            key: const Key('section_financials'),
            title: 'Financials',
            icon: Icons.account_balance_outlined,
            color: AppColors.success,
            children: financialReports
                .map((r) => _ReportTile(
                      label: r.label,
                      onTap: () => context.go(reportsFinancialsPath(r.type)),
                    ))
                .toList(),
          ),
          const SizedBox(height: 20),
          _CategorySection(
            key: const Key('section_hr'),
            title: 'HR',
            icon: Icons.badge_outlined,
            color: AppColors.warning,
            children: hrReportCategories
                .map((cat) => _ReportTile(
                      label: cat.label,
                      trailing: Icons.chevron_right,
                      onTap: () => showModalBottomSheet<void>(
                        context: context,
                        showDragHandle: true,
                        isScrollControlled: true,
                        builder: (context) => _HrCategorySheet(category: cat),
                      ),
                    ))
                .toList(),
          ),
        ],
      ),
    );
  }
}

class _CategorySection extends StatelessWidget {
  const _CategorySection({
    super.key,
    required this.title,
    required this.icon,
    required this.color,
    required this.children,
  });

  final String title;
  final IconData icon;
  final Color color;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 8),
            Text(
              title,
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: theme.cardTheme.color ?? theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
          ),
          child: Column(children: children),
        ),
      ],
    ).animate().fadeIn(duration: 350.ms).slideY(begin: 0.08, end: 0, duration: 350.ms);
  }
}

class _ReportTile extends StatelessWidget {
  const _ReportTile({required this.label, required this.onTap, this.trailing = Icons.chevron_right});

  final String label;
  final VoidCallback onTap;
  final IconData trailing;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      key: Key('reportTile_$label'),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        child: Row(
          children: [
            Expanded(child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
            Icon(trailing, size: 18, color: Theme.of(context).colorScheme.onSurfaceVariant),
          ],
        ),
      ),
    );
  }
}

class _HrCategorySheet extends StatelessWidget {
  const _HrCategorySheet({required this.category});

  final ReportCategory category;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${category.label} reports',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            Flexible(
              child: ListView.separated(
                key: Key('hrSheetList_${category.key}'),
                shrinkWrap: true,
                itemCount: category.items.length,
                separatorBuilder: (_, _) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final item = category.items[index];
                  return ListTile(
                    key: Key('hrReportItem_${item.type}'),
                    title: Text(item.label),
                    trailing: const Icon(Icons.chevron_right, size: 18),
                    onTap: () {
                      Navigator.of(context).pop();
                      context.go(reportsHrPath(category.key, item.type));
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
