import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/theme/app_colors.dart';
import '../application/users_providers.dart';
import '../data/users_repository.dart';
import '../domain/admin_user.dart';

class UserDetailScreen extends ConsumerStatefulWidget {
  const UserDetailScreen({super.key, required this.userId});

  final String userId;

  @override
  ConsumerState<UserDetailScreen> createState() => _UserDetailScreenState();
}

class _UserDetailScreenState extends ConsumerState<UserDetailScreen> {
  bool _updatingStatus = false;

  Future<void> _toggleStatus(AdminUser user) async {
    final nextStatus = user.isActive ? 'DISABLED' : 'ACTIVE';

    if (user.isActive) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Disable this user?'),
          content: Text(
            '${user.name} will not be able to sign in until re-enabled.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              key: const Key('confirmDisableButton'),
              style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Disable'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    }

    setState(() => _updatingStatus = true);
    try {
      await ref.read(usersRepositoryProvider).setStatus(user.id, nextStatus);
      ref.invalidate(userDetailProvider(user.id));
      ref.invalidate(usersListProvider);
      HapticFeedback.lightImpact();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            nextStatus == 'ACTIVE' ? '${user.name} is now active' : '${user.name} has been disabled',
          ),
          backgroundColor: nextStatus == 'ACTIVE' ? AppColors.success : AppColors.danger,
        ),
      );
    } on UserApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Could not update status')));
    } finally {
      if (mounted) setState(() => _updatingStatus = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final userAsync = ref.watch(userDetailProvider(widget.userId));

    return Scaffold(
      appBar: AppBar(title: const Text('User details')),
      body: userAsync.when(
        loading: () => const _UserDetailShimmer(),
        error: (error, stackTrace) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.error_outline, size: 40, color: Theme.of(context).colorScheme.error),
                const SizedBox(height: 12),
                const Text('Could not load this user'),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => ref.invalidate(userDetailProvider(widget.userId)),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (user) => _UserDetailBody(
          user: user,
          updatingStatus: _updatingStatus,
          onToggleStatus: () => _toggleStatus(user),
        ),
      ),
    );
  }
}

class _UserDetailBody extends StatelessWidget {
  const _UserDetailBody({
    required this.user,
    required this.updatingStatus,
    required this.onToggleStatus,
  });

  final AdminUser user;
  final bool updatingStatus;
  final VoidCallback onToggleStatus;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Center(
          child: Column(
            children: [
              CircleAvatar(
                radius: 40,
                backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.12),
                child: Text(
                  user.initials,
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    color: theme.colorScheme.primary,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                user.name,
                key: const Key('userDetailName'),
                style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 2),
              Text(
                user.email,
                style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
              if (user.employee?.designation != null) ...[
                const SizedBox(height: 2),
                Text(
                  '${user.employee!.designation}${user.employee!.department != null ? ' · ${user.employee!.department}' : ''}',
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                ),
              ],
            ],
          ),
        ).animate().fadeIn(duration: 300.ms).slideY(begin: 0.08, end: 0),
        const SizedBox(height: 24),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Account status',
                        style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        user.isActive
                            ? 'This user can sign in and use the app'
                            : 'This user cannot sign in',
                        style: theme.textTheme.bodySmall
                            ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
                if (updatingStatus)
                  const SizedBox(
                    height: 24,
                    width: 24,
                    child: CircularProgressIndicator(strokeWidth: 2.4),
                  )
                else
                  Switch(
                    key: const Key('userStatusSwitch'),
                    value: user.isActive,
                    activeThumbColor: AppColors.success,
                    onChanged: (_) => onToggleStatus(),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        _DetailSection(
          title: 'Role & access',
          children: [
            _DetailRow(icon: Icons.badge_outlined, label: 'Role', value: user.primaryRoleName),
            _DetailRow(
              icon: Icons.store_outlined,
              label: 'Branch access',
              value: user.branchAccessSummary,
            ),
            if (user.defaultBranch != null)
              _DetailRow(
                icon: Icons.location_on_outlined,
                label: 'Default branch',
                value: '${user.defaultBranch!.name} (${user.defaultBranch!.code})',
              ),
          ],
        ),
        if (user.employee != null) ...[
          const SizedBox(height: 16),
          _DetailSection(
            title: 'Employee',
            children: [
              _DetailRow(icon: Icons.tag, label: 'Employee code', value: user.employee!.code),
              if (user.phone != null)
                _DetailRow(icon: Icons.phone_outlined, label: 'Phone', value: user.phone!),
            ],
          ),
        ],
      ],
    );
  }
}

class _DetailSection extends StatelessWidget {
  const _DetailSection({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 18, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: 10),
          Expanded(
            child: Text(label, style: theme.textTheme.bodyMedium),
          ),
          Text(
            value,
            style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class _UserDetailShimmer extends StatelessWidget {
  const _UserDetailShimmer();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = theme.colorScheme.surfaceContainerHighest;
    final highlight = theme.colorScheme.surface;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Center(
          child: Shimmer.fromColors(
            baseColor: base,
            highlightColor: highlight,
            child: CircleAvatar(radius: 40, backgroundColor: base),
          ),
        ),
        const SizedBox(height: 24),
        for (var i = 0; i < 3; i++)
          Shimmer.fromColors(
            baseColor: base,
            highlightColor: highlight,
            child: Container(
              height: 90,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(16)),
            ),
          ),
      ],
    );
  }
}
