import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../application/audit_provider.dart';
import '../domain/audit_entry.dart';

const _jsonEncoder = JsonEncoder.withIndent('  ');

String _prettyJson(dynamic value) {
  if (value == null) return '(none)';
  return _jsonEncoder.convert(value);
}

/// Full detail for one audit entry, including the before/after JSONB diff
/// pretty-printed in a monospace block.
class AuditDetailScreen extends ConsumerWidget {
  const AuditDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entryAsync = ref.watch(auditDetailProvider(id));

    return Scaffold(
      appBar: AppBar(title: const Text('Audit Entry')),
      body: entryAsync.when(
        data: (entry) => _AuditDetailBody(entry: entry),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 40, color: AppColors.danger),
                const SizedBox(height: 12),
                Text('Failed to load audit entry', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 8),
                Text('$error', textAlign: TextAlign.center),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: () => ref.invalidate(auditDetailProvider(id)),
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AuditDetailBody extends StatelessWidget {
  const _AuditDetailBody({required this.entry});

  final AuditEntry entry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ts = entry.createdAt;
    final timeLabel =
        '${ts.year.toString().padLeft(4, '0')}-${ts.month.toString().padLeft(2, '0')}-${ts.day.toString().padLeft(2, '0')} '
        '${ts.hour.toString().padLeft(2, '0')}:${ts.minute.toString().padLeft(2, '0')}:${ts.second.toString().padLeft(2, '0')}';

    return ListView(
      key: const Key('auditDetailList'),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: theme.cardTheme.color ?? theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                entry.action,
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              _InfoRow(label: 'Actor', value: entry.actor?.name ?? 'System'),
              _InfoRow(label: 'Actor email', value: entry.actor?.email ?? '—'),
              _InfoRow(label: 'Module', value: entry.module),
              _InfoRow(label: 'Entity', value: '${entry.entityType} · ${entry.entityId}'),
              _InfoRow(label: 'Branch', value: entry.branch?.name ?? '—'),
              _InfoRow(label: 'IP address', value: entry.ip ?? '—'),
              _InfoRow(label: 'User agent', value: entry.userAgent ?? '—'),
              _InfoRow(label: 'Timestamp', value: timeLabel),
            ],
          ),
        ).animate().fadeIn(duration: 300.ms),
        const SizedBox(height: 20),
        Text('Before', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        _JsonBlock(key: const Key('auditBeforeBlock'), data: entry.before, color: AppColors.danger),
        const SizedBox(height: 20),
        Text('After', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        _JsonBlock(key: const Key('auditAfterBlock'), data: entry.after, color: AppColors.success),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          ),
          Expanded(child: Text(value, style: theme.textTheme.bodyMedium)),
        ],
      ),
    );
  }
}

class _JsonBlock extends StatelessWidget {
  const _JsonBlock({super.key, required this.data, required this.color});

  final dynamic data;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: SelectableText(
        _prettyJson(data),
        style: theme.textTheme.bodySmall?.copyWith(
          fontFamily: 'monospace',
          height: 1.5,
        ),
      ),
    ).animate().fadeIn(duration: 300.ms);
  }
}
