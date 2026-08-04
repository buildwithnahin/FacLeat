import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../application/notifications_providers.dart';
import '../notification_center_screen.dart';

/// Bell icon with an unread-count badge, meant to be dropped into the main
/// app bar's `actions` in a later integration step — this file only builds
/// the standalone widget; it does not wire itself into any shell/app bar.
///
/// Navigation: if [onTap] is supplied it is called instead of the default
/// behavior. Otherwise tapping the bell pushes [NotificationCenterScreen] via
/// a plain `MaterialPageRoute` (not go_router), so this widget works
/// standalone without a `/notifications` route existing yet. When routing is
/// wired up, pass `onTap: () => context.push(notificationsRoute)` (or
/// similar) to use go_router's stack instead.
class NotificationBell extends ConsumerWidget {
  const NotificationBell({super.key, this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unreadCountAsync = ref.watch(unreadCountProvider);
    final count = unreadCountAsync.valueOrNull ?? 0;

    return IconButton(
      key: const Key('notificationBellButton'),
      tooltip: 'Notifications',
      onPressed: onTap ??
          () {
            Navigator.of(context).push<void>(
              MaterialPageRoute<void>(builder: (_) => const NotificationCenterScreen()),
            );
          },
      icon: Badge(
        key: const Key('notificationBellBadge'),
        isLabelVisible: count > 0,
        label: Text(count > 9 ? '9+' : '$count'),
        backgroundColor: AppColors.danger,
        child: const Icon(Icons.notifications_outlined),
      ),
    );
  }
}
