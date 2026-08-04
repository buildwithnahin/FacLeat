import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/router/main_shell.dart';
import '../../../core/theme/app_colors.dart';
import '../application/audit_provider.dart';
import '../domain/audit_entry.dart';

/// Infinite-scroll audit trail with a module / date-range / search filter
/// sheet. Each row deep-links to [AuditDetailScreen] for the before/after
/// JSONB diff.
class AuditListScreen extends ConsumerStatefulWidget {
  const AuditListScreen({super.key});

  @override
  ConsumerState<AuditListScreen> createState() => _AuditListScreenState();
}

class _AuditListScreenState extends ConsumerState<AuditListScreen> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    Future.microtask(() => ref.read(auditListProvider.notifier).loadFirstPage());
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 240) {
      ref.read(auditListProvider.notifier).loadMore();
    }
  }

  Future<void> _openFilterSheet() async {
    final current = ref.read(auditListProvider).filter;
    final result = await showModalBottomSheet<AuditFilter>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _AuditFilterSheet(initial: current),
    );
    if (result != null) {
      await ref.read(auditListProvider.notifier).applyFilter(result);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(auditListProvider);
    final hasFilters = state.filter != const AuditFilter();

    return Scaffold(
      appBar: AppBar(
        leading: const DrawerMenuButton(),
        title: const Text('Audit Log'),
        actions: [
          IconButton(
            key: const Key('auditFilterButton'),
            tooltip: 'Filter',
            onPressed: _openFilterSheet,
            icon: Badge(
              isLabelVisible: hasFilters,
              smallSize: 8,
              child: const Icon(Icons.filter_list),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(auditListProvider.notifier).loadFirstPage(),
        child: _buildBody(state),
      ),
    );
  }

  Widget _buildBody(AuditListState state) {
    if (state.status == AuditListStatus.loading && state.entries.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.status == AuditListStatus.error && state.entries.isEmpty) {
      return ListView(
        children: [
          const SizedBox(height: 100),
          const Icon(Icons.error_outline, size: 40, color: AppColors.danger),
          const SizedBox(height: 12),
          Center(child: Text(state.errorMessage ?? 'Failed to load audit log')),
          const SizedBox(height: 16),
          Center(
            child: OutlinedButton.icon(
              onPressed: () => ref.read(auditListProvider.notifier).loadFirstPage(),
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ),
        ],
      );
    }
    if (state.entries.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 120),
          Icon(Icons.history_toggle_off_outlined, size: 40, color: Colors.grey),
          SizedBox(height: 12),
          Center(child: Text('No audit entries found')),
        ],
      );
    }

    return ListView.separated(
      key: const Key('auditListView'),
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: state.entries.length + (state.hasMore ? 1 : 0),
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, index) {
        if (index >= state.entries.length) {
          return const Padding(
            padding: EdgeInsets.all(16),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)),
          );
        }
        final entry = state.entries[index];
        return _AuditRow(entry: entry, index: index);
      },
    );
  }
}

class _AuditRow extends StatelessWidget {
  const _AuditRow({required this.entry, required this.index});

  final AuditEntry entry;
  final int index;

  Color _actionColor(String action) {
    final upper = action.toUpperCase();
    if (upper.contains('DELETE') || upper.contains('FAIL') || upper.contains('REJECT')) {
      return AppColors.danger;
    }
    if (upper.contains('UPDATE') || upper.contains('PENDING')) return AppColors.warning;
    return AppColors.success;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = _actionColor(entry.action);
    final ts = entry.createdAt;
    final timeLabel =
        '${ts.year.toString().padLeft(4, '0')}-${ts.month.toString().padLeft(2, '0')}-${ts.day.toString().padLeft(2, '0')} '
        '${ts.hour.toString().padLeft(2, '0')}:${ts.minute.toString().padLeft(2, '0')}';

    return ListTile(
      key: Key('auditRow_${entry.id}'),
      onTap: () => context.go(auditDetailPath(entry.id)),
      leading: CircleAvatar(
        backgroundColor: color.withValues(alpha: 0.12),
        child: Icon(Icons.bolt, size: 18, color: color),
      ),
      title: Text(
        '${entry.actor?.name ?? 'System'} · ${entry.action}',
        style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text(
        '${entry.module} · ${entry.entityType} · $timeLabel',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
      ),
      trailing: const Icon(Icons.chevron_right, size: 18),
    ).animate().fadeIn(delay: (index.clamp(0, 12) * 30).ms, duration: 250.ms);
  }
}

class _AuditFilterSheet extends StatefulWidget {
  const _AuditFilterSheet({required this.initial});

  final AuditFilter initial;

  @override
  State<_AuditFilterSheet> createState() => _AuditFilterSheetState();
}

class _AuditFilterSheetState extends State<_AuditFilterSheet> {
  late String? _module = widget.initial.module;
  late DateTime? _from = widget.initial.from;
  late DateTime? _to = widget.initial.to;
  late final _searchController = TextEditingController(text: widget.initial.search ?? '');

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer(
      builder: (context, ref, _) {
        final modulesAsync = ref.watch(auditModulesProvider);
        return SafeArea(
          child: Padding(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 4,
              bottom: MediaQuery.of(context).viewInsets.bottom + 16,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Filter audit log', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 16),
                TextField(
                  key: const Key('auditSearchField'),
                  controller: _searchController,
                  decoration: const InputDecoration(
                    labelText: 'Search',
                    prefixIcon: Icon(Icons.search),
                  ),
                ),
                const SizedBox(height: 12),
                modulesAsync.when(
                  data: (modules) => DropdownButtonFormField<String>(
                    key: const Key('auditModuleDropdown'),
                    initialValue: _module,
                    decoration: const InputDecoration(labelText: 'Module', prefixIcon: Icon(Icons.apps)),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('All modules')),
                      ...modules.map((m) => DropdownMenuItem(value: m, child: Text(m))),
                    ],
                    onChanged: (value) => setState(() => _module = value),
                  ),
                  loading: () => const LinearProgressIndicator(),
                  error: (_, _) => const SizedBox.shrink(),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  key: const Key('auditDateRangeButton'),
                  onPressed: () async {
                    final result = await showDateRangePicker(
                      context: context,
                      firstDate: DateTime(2020),
                      lastDate: DateTime.now().add(const Duration(days: 1)),
                      initialDateRange: _from != null && _to != null ? DateTimeRange(start: _from!, end: _to!) : null,
                    );
                    if (result != null) {
                      setState(() {
                        _from = result.start;
                        _to = result.end;
                      });
                    }
                  },
                  icon: const Icon(Icons.date_range_outlined),
                  label: Text(
                    _from != null && _to != null
                        ? '${_from!.year}-${_from!.month.toString().padLeft(2, '0')}-${_from!.day.toString().padLeft(2, '0')} → '
                            '${_to!.year}-${_to!.month.toString().padLeft(2, '0')}-${_to!.day.toString().padLeft(2, '0')}'
                        : 'Any date',
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(context).pop(const AuditFilter()),
                        child: const Text('Clear'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        key: const Key('applyAuditFilterButton'),
                        onPressed: () => Navigator.of(context).pop(
                          AuditFilter(
                            module: _module,
                            search: _searchController.text.trim().isEmpty ? null : _searchController.text.trim(),
                            from: _from,
                            to: _to,
                          ),
                        ),
                        child: const Text('Apply'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
