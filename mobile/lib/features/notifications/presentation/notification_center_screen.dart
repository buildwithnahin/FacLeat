import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../application/notifications_providers.dart';
import '../domain/notification_item.dart';

/// Best-effort mapping from a web-app `href` (e.g. `/audit/abc123`) to an
/// existing mobile route. Only patterns with a confident 1:1 mobile
/// equivalent are matched; anything else (e.g. `/approvals/...`, which has
/// no mobile screen yet) falls through to `null` and is simply not followed.
String? _mapHrefToMobileRoute(String href) {
  final auditMatch = RegExp(r'^/audit/([^/]+)/?$').firstMatch(href);
  if (auditMatch != null) return auditDetailPath(auditMatch.group(1)!);

  final userMatch = RegExp(r'^/users/([^/]+)/?$').firstMatch(href);
  if (userMatch != null) return userDetailPath(userMatch.group(1)!);

  final roleMatch = RegExp(r'^/roles/([^/]+)/?$').firstMatch(href);
  if (roleMatch != null) return roleDetailPath(roleMatch.group(1)!);

  return null;
}

/// Live-updating notification feed: All/Unread filter, mark-read on tap,
/// mark-all-read action, best-effort deep-link follow, and an SSE
/// subscription that keeps the list fresh while this screen is open.
class NotificationCenterScreen extends ConsumerWidget {
  const NotificationCenterScreen({super.key});

  Future<void> _handleRowTap(BuildContext context, WidgetRef ref, NotificationItem item) async {
    if (item.isUnread) {
      await markNotificationRead(ref, item.id);
    }
    final href = item.href;
    if (href == null) return;
    final mobileRoute = _mapHrefToMobileRoute(href);
    if (mobileRoute != null && context.mounted) {
      context.push(mobileRoute);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Keep the SSE connection open for as long as this screen is mounted;
    // errors surface only as a broken connection (list still works via pull-
    // to-refresh), so the AsyncValue itself is intentionally not rendered.
    ref.watch(notificationsSseProvider);

    final listAsync = ref.watch(notificationsListProvider);
    final unreadOnly = ref.watch(notificationsUnreadOnlyProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            key: const Key('markAllReadButton'),
            onPressed: () => markAllNotificationsRead(ref),
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Align(
              alignment: Alignment.centerLeft,
              child: SegmentedButton<bool>(
                key: const Key('notificationsFilterSegment'),
                segments: const [
                  ButtonSegment(value: false, label: Text('All')),
                  ButtonSegment(value: true, label: Text('Unread')),
                ],
                selected: {unreadOnly},
                onSelectionChanged: (selection) =>
                    ref.read(notificationsUnreadOnlyProvider.notifier).set(selection.first),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(notificationsListProvider);
                await ref.read(notificationsListProvider.future);
              },
              child: listAsync.when(
                loading: () => const _NotificationsShimmer(),
                error: (error, stackTrace) => _NotificationsError(
                  onRetry: () => ref.invalidate(notificationsListProvider),
                ),
                data: (items) {
                  if (items.isEmpty) {
                    return _EmptyNotifications(unreadOnly: unreadOnly);
                  }
                  return ListView.separated(
                    key: const Key('notificationsListView'),
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final item = items[index];
                      return _NotificationRow(
                        item: item,
                        index: index,
                        onTap: () => _handleRowTap(context, ref, item),
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({required this.item, required this.index, required this.onTap});

  final NotificationItem item;
  final int index;
  final VoidCallback onTap;

  Color _severityColor(NotificationSeverity severity) {
    switch (severity) {
      case NotificationSeverity.info:
        return AppColors.primary;
      case NotificationSeverity.warning:
        return AppColors.warning;
      case NotificationSeverity.critical:
        return AppColors.danger;
    }
  }

  IconData _severityIcon(NotificationSeverity severity) {
    switch (severity) {
      case NotificationSeverity.info:
        return Icons.info_outline;
      case NotificationSeverity.warning:
        return Icons.warning_amber_outlined;
      case NotificationSeverity.critical:
        return Icons.error_outline;
    }
  }

  String _timeLabel(DateTime ts) {
    final local = ts.toLocal();
    return '${local.year.toString().padLeft(4, '0')}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')} '
        '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = _severityColor(item.severity);
    final isUnread = item.isUnread;
    final body = item.body;

    return Opacity(
      opacity: isUnread ? 1 : 0.6,
      child: ListTile(
        key: Key('notificationRow_${item.id}'),
        onTap: onTap,
        leading: Stack(
          clipBehavior: Clip.none,
          children: [
            CircleAvatar(
              backgroundColor: color.withValues(alpha: 0.12),
              child: Icon(_severityIcon(item.severity), size: 18, color: color),
            ),
            if (isUnread)
              Positioned(
                right: -1,
                top: -1,
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                    border: Border.all(color: theme.scaffoldBackgroundColor, width: 1.5),
                  ),
                ),
              ),
          ],
        ),
        title: Text(
          item.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.bodyMedium?.copyWith(
            fontWeight: isUnread ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (body != null && body.isNotEmpty)
              Text(
                body,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
            const SizedBox(height: 2),
            Text(
              '${item.module} · ${_timeLabel(item.createdAt)}',
              style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
          ],
        ),
        isThreeLine: body != null && body.isNotEmpty,
        trailing: item.href != null ? const Icon(Icons.chevron_right, size: 18) : null,
      ),
    ).animate().fadeIn(delay: (index.clamp(0, 12) * 30).ms, duration: 250.ms);
  }
}

class _NotificationsShimmer extends StatelessWidget {
  const _NotificationsShimmer();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = theme.colorScheme.surfaceContainerHighest;
    final highlight = theme.colorScheme.surface;

    return ListView.builder(
      key: const Key('notificationsShimmer'),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      itemCount: 6,
      itemBuilder: (context, index) => Shimmer.fromColors(
        baseColor: base,
        highlightColor: highlight,
        child: Container(
          height: 76,
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(16)),
        ),
      ),
    );
  }
}

class _NotificationsError extends StatelessWidget {
  const _NotificationsError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      children: [
        const SizedBox(height: 100),
        Icon(Icons.error_outline, size: 40, color: theme.colorScheme.error),
        const SizedBox(height: 12),
        const Center(child: Text('Could not load notifications')),
        const SizedBox(height: 16),
        Center(
          child: OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ),
      ],
    );
  }
}

class _EmptyNotifications extends StatelessWidget {
  const _EmptyNotifications({required this.unreadOnly});

  final bool unreadOnly;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      children: [
        const SizedBox(height: 120),
        Icon(Icons.notifications_none_outlined, size: 40, color: theme.colorScheme.onSurfaceVariant),
        const SizedBox(height: 12),
        Center(
          child: Text(
            unreadOnly ? "You're all caught up" : 'No notifications',
            style: theme.textTheme.titleMedium,
          ),
        ),
      ],
    );
  }
}
