import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shimmer/shimmer.dart';

import '../application/workspace_providers.dart';
import '../domain/company.dart';

/// Read-only list of every company/tenant this superadmin can see. Reached
/// from the "Companies" dashboard KPI card and the drawer's Workspace
/// section — a lightweight lookup, not a full company-management module.
class CompaniesScreen extends ConsumerWidget {
  const CompaniesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final companiesAsync = ref.watch(companiesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Companies')),
      body: companiesAsync.when(
        loading: () => const _WorkspaceListShimmer(),
        error: (error, stackTrace) => _WorkspaceError(
          message: 'Could not load companies',
          onRetry: () => ref.invalidate(companiesProvider),
        ),
        data: (companies) {
          if (companies.isEmpty) {
            return const _WorkspaceEmpty(message: 'No companies found');
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(companiesProvider.future),
            child: ListView.builder(
              key: const Key('companiesListView'),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: companies.length,
              itemBuilder: (context, index) {
                final company = companies[index];
                return _CompanyTile(company: company)
                    .animate(delay: (index * 40).ms)
                    .fadeIn(duration: 280.ms, curve: Curves.easeOut)
                    .slideY(begin: 0.12, end: 0, duration: 280.ms, curve: Curves.easeOut);
              },
            ),
          );
        },
      ),
    );
  }
}

class _CompanyTile extends StatelessWidget {
  const _CompanyTile({required this.company});

  final Company company;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(Icons.apartment_outlined, color: theme.colorScheme.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    company.name,
                    style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (company.code.isNotEmpty)
                    Text(
                      company.code,
                      style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _WorkspaceListShimmer extends StatelessWidget {
  const _WorkspaceListShimmer();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = theme.colorScheme.surfaceContainerHighest;
    final highlight = theme.colorScheme.surface;

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      itemCount: 5,
      itemBuilder: (context, index) => Shimmer.fromColors(
        baseColor: base,
        highlightColor: highlight,
        child: Container(
          height: 72,
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(16)),
        ),
      ),
    );
  }
}

class _WorkspaceError extends StatelessWidget {
  const _WorkspaceError({required this.message, required this.onRetry});

  final String message;
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
            Text(message, style: theme.textTheme.titleMedium),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

class _WorkspaceEmpty extends StatelessWidget {
  const _WorkspaceEmpty({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.inbox_outlined, size: 40, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(height: 12),
            Text(message, style: theme.textTheme.titleMedium),
          ],
        ),
      ),
    );
  }
}
