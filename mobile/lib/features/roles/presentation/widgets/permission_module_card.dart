import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../domain/permission.dart';

/// Expand/collapse card for one permission module (e.g. "inventory"),
/// showing an all/partial/none tri-state indicator in the header and a
/// checkbox per individual action inside.
///
/// Purely presentational: the caller (see `role_form_screen.dart`) owns the
/// selected-keys state and passes callbacks for both a single-permission
/// toggle and a "select/clear all in this module" toggle, which keeps this
/// widget trivial to unit test in isolation.
class PermissionModuleCard extends StatefulWidget {
  const PermissionModuleCard({
    super.key,
    required this.module,
    required this.permissions,
    required this.selectedKeys,
    required this.onToggle,
    required this.onToggleAll,
    this.initiallyExpanded = false,
  });

  /// Module name, e.g. `"inventory"`.
  final String module;

  /// All permissions belonging to this module.
  final List<MobilePermission> permissions;

  /// The full set of currently-selected permission keys (not just this
  /// module's) — the card filters down to what's relevant to it.
  final Set<String> selectedKeys;

  /// Called with a single permission `key` when its row is tapped.
  final ValueChanged<String> onToggle;

  /// Called when the header checkbox/dot is tapped. `true` means "select
  /// every permission in this module", `false` means "clear every
  /// permission in this module".
  final ValueChanged<bool> onToggleAll;

  final bool initiallyExpanded;

  @override
  State<PermissionModuleCard> createState() => _PermissionModuleCardState();
}

class _PermissionModuleCardState extends State<PermissionModuleCard> {
  late bool _expanded = widget.initiallyExpanded;

  int get _selectedCount =>
      widget.permissions.where((p) => widget.selectedKeys.contains(p.key)).length;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final total = widget.permissions.length;
    final selected = _selectedCount;
    final allSelected = total > 0 && selected == total;
    final noneSelected = selected == 0;

    return Card(
      clipBehavior: Clip.antiAlias,
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        children: [
          InkWell(
            key: Key('module-header-${widget.module}'),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  _ModuleStatusDot(allSelected: allSelected, noneSelected: noneSelected),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _titleCase(widget.module),
                          style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '$selected of $total selected',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Checkbox(
                    key: Key('module-checkbox-${widget.module}'),
                    tristate: true,
                    value: allSelected ? true : (noneSelected ? false : null),
                    onChanged: (_) => widget.onToggleAll(!allSelected),
                  ),
                  AnimatedRotation(
                    turns: _expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    curve: Curves.easeInOut,
                    child: const Icon(Icons.expand_more),
                  ),
                ],
              ),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeInOut,
            alignment: Alignment.topCenter,
            child: _expanded
                ? Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Column(
                      children: [
                        for (final permission in widget.permissions)
                          CheckboxListTile(
                            key: Key('perm-checkbox-${permission.key}'),
                            dense: true,
                            visualDensity: VisualDensity.compact,
                            controlAffinity: ListTileControlAffinity.leading,
                            title: Text(_titleCase(permission.action)),
                            value: widget.selectedKeys.contains(permission.key),
                            onChanged: (_) => widget.onToggle(permission.key),
                          ),
                      ],
                    ),
                  )
                : const SizedBox(width: double.infinity, height: 0),
          ),
        ],
      ),
    );
  }
}

class _ModuleStatusDot extends StatelessWidget {
  const _ModuleStatusDot({required this.allSelected, required this.noneSelected});

  final bool allSelected;
  final bool noneSelected;

  @override
  Widget build(BuildContext context) {
    final Color color;
    if (allSelected) {
      color = AppColors.success;
    } else if (noneSelected) {
      color = Theme.of(context).colorScheme.outlineVariant;
    } else {
      color = AppColors.warning;
    }
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: 10,
      height: 10,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

String _titleCase(String value) {
  final withSpaces = value.replaceAll('-', ' ').replaceAll('_', ' ');
  return withSpaces
      .split(' ')
      .where((w) => w.isNotEmpty)
      .map((w) => w[0].toUpperCase() + w.substring(1))
      .join(' ');
}
