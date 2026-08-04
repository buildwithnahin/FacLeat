import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/router/app_router.dart';
import '../../../core/router/main_shell.dart';
import '../../../core/theme/app_colors.dart';
import '../application/users_providers.dart';
import '../domain/admin_user.dart';

class UsersListScreen extends ConsumerStatefulWidget {
  const UsersListScreen({super.key});

  @override
  ConsumerState<UsersListScreen> createState() => _UsersListScreenState();
}

class _UsersListScreenState extends ConsumerState<UsersListScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final usersAsync = ref.watch(usersListProvider);

    return Scaffold(
      appBar: AppBar(leading: const DrawerMenuButton(), title: const Text('Users')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              key: const Key('userSearchField'),
              controller: _searchController,
              onChanged: (value) => setState(() => _query = value.trim().toLowerCase()),
              decoration: InputDecoration(
                hintText: 'Search users by name or email',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _query = '');
                        },
                      ),
              ),
            ),
          ),
          Expanded(
            child: usersAsync.when(
              loading: () => const _UsersListShimmer(),
              error: (error, stackTrace) => _UsersListError(
                onRetry: () => ref.invalidate(usersListProvider),
              ),
              data: (users) {
                final filtered = _query.isEmpty
                    ? users
                    : users
                        .where((u) =>
                            u.name.toLowerCase().contains(_query) ||
                            u.email.toLowerCase().contains(_query))
                        .toList();

                if (filtered.isEmpty) {
                  return const _EmptyUsersState();
                }

                return RefreshIndicator(
                  onRefresh: () => ref.refresh(usersListProvider.future),
                  child: ListView.builder(
                    key: const Key('usersListView'),
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final user = filtered[index];
                      return _UserListTile(user: user)
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

class _UserListTile extends StatelessWidget {
  const _UserListTile({required this.user});

  final AdminUser user;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push(userDetailPath(user.id)),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.12),
                child: Text(
                  user.initials,
                  style: TextStyle(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            user.name,
                            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        _StatusPill(isActive: user.isActive),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      user.email,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        _InfoChip(icon: Icons.badge_outlined, label: user.primaryRoleName),
                        _InfoChip(icon: Icons.store_outlined, label: user.branchAccessSummary),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 4),
              Icon(Icons.chevron_right, color: theme.colorScheme.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: 4),
          Text(
            label,
            style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.isActive});

  final bool isActive;

  @override
  Widget build(BuildContext context) {
    final color = isActive ? AppColors.success : AppColors.danger;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        isActive ? 'ACTIVE' : 'DISABLED',
        style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 10, letterSpacing: 0.3),
      ),
    );
  }
}

class _UsersListShimmer extends StatelessWidget {
  const _UsersListShimmer();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = theme.colorScheme.surfaceContainerHighest;
    final highlight = theme.colorScheme.surface;

    return ListView.builder(
      key: const Key('usersListShimmer'),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      itemCount: 6,
      itemBuilder: (context, index) => Shimmer.fromColors(
        baseColor: base,
        highlightColor: highlight,
        child: Container(
          height: 92,
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(16)),
        ),
      ),
    );
  }
}

class _UsersListError extends StatelessWidget {
  const _UsersListError({required this.onRetry});

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
            Text('Could not load users', style: theme.textTheme.titleMedium),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

class _EmptyUsersState extends StatelessWidget {
  const _EmptyUsersState();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.search_off, size: 40, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(height: 12),
            Text('No users found', style: theme.textTheme.titleMedium),
          ],
        ),
      ),
    );
  }
}
