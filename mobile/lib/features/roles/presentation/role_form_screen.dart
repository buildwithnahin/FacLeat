import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/router/app_router.dart';
import '../application/roles_providers.dart';
import '../data/roles_repository.dart';
import '../domain/permission.dart';
import '../domain/role.dart';
import 'widgets/permission_module_card.dart';

/// Role detail/edit/create screen — same screen for `roleDetailRoute` and
/// `roleNewRoute`, keyed off whether [roleId] is present. This just resolves
/// the two async dependencies (all permissions + the existing role, if any)
/// before handing off to [_RoleFormBody], which owns the actual form state.
class RoleFormScreen extends ConsumerWidget {
  const RoleFormScreen({super.key, this.roleId});

  final String? roleId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final permissionsAsync = ref.watch(permissionsProvider);

    return permissionsAsync.when(
      loading: () => const _RoleFormLoadingScaffold(),
      error: (error, stackTrace) => _RoleFormErrorScaffold(
        onRetry: () => ref.invalidate(permissionsProvider),
      ),
      data: (permissions) {
        if (roleId == null) {
          return _RoleFormBody(
            key: const ValueKey('role-form-create'),
            roleId: null,
            initialRole: null,
            allPermissions: permissions,
          );
        }

        final roleAsync = ref.watch(roleDetailProvider(roleId!));
        return roleAsync.when(
          loading: () => const _RoleFormLoadingScaffold(),
          error: (error, stackTrace) => _RoleFormErrorScaffold(
            onRetry: () => ref.invalidate(roleDetailProvider(roleId!)),
          ),
          data: (role) => _RoleFormBody(
            key: ValueKey('role-form-${role.id}'),
            roleId: role.id,
            initialRole: role,
            allPermissions: permissions,
          ),
        );
      },
    );
  }
}

class _RoleFormLoadingScaffold extends StatelessWidget {
  const _RoleFormLoadingScaffold();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = theme.colorScheme.surfaceContainerHighest;
    final highlight = theme.colorScheme.surface;
    return Scaffold(
      appBar: AppBar(title: const Text('Role')),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 5,
        itemBuilder: (context, index) => Shimmer.fromColors(
          baseColor: base,
          highlightColor: highlight,
          child: Container(
            height: index == 0 ? 96 : 64,
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(16)),
          ),
        ),
      ),
    );
  }
}

class _RoleFormErrorScaffold extends StatelessWidget {
  const _RoleFormErrorScaffold({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Role')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 40, color: theme.colorScheme.error),
              const SizedBox(height: 12),
              Text('Could not load this role', style: theme.textTheme.titleMedium),
              const SizedBox(height: 16),
              FilledButton(onPressed: onRetry, child: const Text('Retry')),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoleFormBody extends ConsumerStatefulWidget {
  const _RoleFormBody({
    super.key,
    required this.roleId,
    required this.initialRole,
    required this.allPermissions,
  });

  final String? roleId;
  final MobileRole? initialRole;
  final List<MobilePermission> allPermissions;

  bool get isCreate => roleId == null;

  @override
  ConsumerState<_RoleFormBody> createState() => _RoleFormBodyState();
}

enum _SaveState { idle, saving, saved }

class _RoleFormBodyState extends ConsumerState<_RoleFormBody> {
  late final TextEditingController _nameController =
      TextEditingController(text: widget.initialRole?.name ?? '');
  late final TextEditingController _descController =
      TextEditingController(text: widget.initialRole?.description ?? '');
  late final Set<String> _selectedKeys = {...(widget.initialRole?.permissionKeys ?? const {})};
  late final Map<String, List<MobilePermission>> _grouped = _groupByModule(widget.allPermissions);

  _SaveState _saveState = _SaveState.idle;
  String? _errorMessage;

  bool get _isSystem => widget.initialRole?.isSystem ?? false;

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Map<String, List<MobilePermission>> _groupByModule(List<MobilePermission> permissions) {
    final map = <String, List<MobilePermission>>{};
    for (final permission in permissions) {
      map.putIfAbsent(permission.module, () => []).add(permission);
    }
    final sortedModules = map.keys.toList()..sort();
    return {
      for (final module in sortedModules)
        module: map[module]!..sort((a, b) => a.action.compareTo(b.action)),
    };
  }

  void _toggleOne(String key) {
    setState(() {
      if (_selectedKeys.contains(key)) {
        _selectedKeys.remove(key);
      } else {
        _selectedKeys.add(key);
      }
    });
  }

  void _toggleModule(String module, bool selectAll) {
    setState(() {
      final keys = _grouped[module]!.map((p) => p.key);
      if (selectAll) {
        _selectedKeys.addAll(keys);
      } else {
        _selectedKeys.removeAll(keys);
      }
    });
  }

  Future<void> _save() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      setState(() => _errorMessage = 'Role name is required');
      return;
    }

    setState(() {
      _saveState = _SaveState.saving;
      _errorMessage = null;
    });

    try {
      final repo = ref.read(rolesRepositoryProvider);
      if (widget.isCreate) {
        await repo.create(
          name: name,
          description: _descController.text.trim(),
          permissionKeys: _selectedKeys.toList(),
        );
      } else {
        await repo.update(
          id: widget.roleId!,
          name: name,
          description: _descController.text.trim(),
          permissionKeys: _selectedKeys.toList(),
        );
      }

      ref.invalidate(rolesListProvider);
      if (!widget.isCreate) {
        ref.invalidate(roleDetailProvider(widget.roleId!));
      }
      HapticFeedback.mediumImpact();

      if (!mounted) return;
      setState(() => _saveState = _SaveState.saved);
      await Future<void>.delayed(const Duration(milliseconds: 700));
      if (!mounted) return;
      if (context.canPop()) {
        context.pop();
      } else {
        // No back stack (e.g. a cold deep link straight into this form) —
        // `rolesRoute` is a top-level pushed route post Phase-5's nav
        // restructure, not a shell branch, so going there would still leave
        // the user without the bottom nav / drawer. Land on Home instead,
        // which is a shell branch and gives access to everywhere, Roles
        // included.
        context.go(homeRoute);
      }
    } on RoleApiException catch (e) {
      setState(() {
        _saveState = _SaveState.idle;
        _errorMessage = e.message;
      });
    } catch (_) {
      setState(() {
        _saveState = _SaveState.idle;
        _errorMessage = 'Something went wrong. Please try again.';
      });
    }
  }

  Future<void> _confirmDelete() async {
    final role = widget.initialRole;
    if (role == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete role?'),
        content: Text('This permanently deletes "${role.name}". This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      await ref.read(rolesRepositoryProvider).delete(role.id);
      ref.invalidate(rolesListProvider);
      if (!mounted) return;
      if (context.canPop()) {
        context.pop();
      } else {
        // Same cold-deep-link fallback reasoning as the save handler above.
        context.go(homeRoute);
      }
    } on RoleApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Could not delete role')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final total = widget.allPermissions.length;
    final role = widget.initialRole;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isCreate ? 'New role' : role?.name ?? 'Role'),
        actions: [
          if (!widget.isCreate && role != null && role.canDelete)
            IconButton(
              key: const Key('deleteRoleButton'),
              icon: const Icon(Icons.delete_outline),
              tooltip: 'Delete role',
              onPressed: _confirmDelete,
            ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  key: const Key('roleNameField'),
                  controller: _nameController,
                  enabled: !_isSystem,
                  decoration: const InputDecoration(labelText: 'Role name'),
                ),
                if (_isSystem)
                  Padding(
                    padding: const EdgeInsets.only(top: 6, left: 4),
                    child: Text(
                      'System role — name cannot be changed',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                const SizedBox(height: 12),
                TextField(
                  key: const Key('roleDescriptionField'),
                  controller: _descController,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: 'Description (optional)'),
                ),
                if (_errorMessage != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Text(
                      _errorMessage!,
                      key: const Key('roleFormErrorText'),
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  ).animate().shakeX(hz: 4, amount: 6),
              ],
            ),
          ),
          _PermissionsCounterBar(selected: _selectedKeys.length, total: total),
          Expanded(
            child: ListView(
              key: const Key('permissionModulesList'),
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 110),
              children: [
                for (final entry in _grouped.entries)
                  PermissionModuleCard(
                    key: Key('module-card-${entry.key}'),
                    module: entry.key,
                    permissions: entry.value,
                    selectedKeys: _selectedKeys,
                    onToggle: _toggleOne,
                    onToggleAll: (selectAll) => _toggleModule(entry.key, selectAll),
                  ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: _SaveButton(state: _saveState, onPressed: _save),
        ),
      ),
    );
  }
}

class _PermissionsCounterBar extends StatelessWidget {
  const _PermissionsCounterBar({required this.selected, required this.total});

  final int selected;
  final int total;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      key: const Key('permissionsCounterBar'),
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: theme.colorScheme.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.checklist_rtl, size: 18, color: theme.colorScheme.primary),
          const SizedBox(width: 8),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: Text(
              '$selected of $total permissions selected',
              key: ValueKey(selected),
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: theme.colorScheme.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SaveButton extends StatelessWidget {
  const _SaveButton({required this.state, required this.onPressed});

  final _SaveState state;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      key: const Key('saveRoleButton'),
      onPressed: state == _SaveState.saving ? null : onPressed,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 220),
        transitionBuilder: (child, animation) => ScaleTransition(scale: animation, child: child),
        child: switch (state) {
          _SaveState.idle => const Text('Save role', key: ValueKey('idle')),
          _SaveState.saving => const SizedBox(
              key: ValueKey('saving'),
              height: 20,
              width: 20,
              child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
            ),
          _SaveState.saved => const Icon(Icons.check, key: ValueKey('saved'), color: Colors.white),
        },
      ),
    );
  }
}
