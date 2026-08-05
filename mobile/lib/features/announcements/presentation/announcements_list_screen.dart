import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/theme/app_colors.dart';
import '../application/announcements_providers.dart';
import '../domain/announcement.dart';

// NOTE: `/announcements/:id` and `/announcements/new` aren't registered in
// app_router.dart yet — that wiring happens in a later integration step.
// These literal paths match the convention used by roleDetailPath /
// approvalDetailPath so they'll resolve once registered.
String announcementDetailPath(String id) => '/announcements/$id';
const String announcementComposeRoute = '/announcements/new';

/// Color for a given announcement audience type — informational only (not a
/// status), so this intentionally stays in the primary/blue family rather
/// than reusing the green/amber/red status palette.
Color audienceColor(String audienceType) => AppColors.primary;

IconData audienceIcon(String audienceType) {
  switch (audienceType) {
    case 'BRANCH':
      return Icons.store_outlined;
    case 'DEPARTMENT':
      return Icons.apartment_outlined;
    case 'USER':
      return Icons.person_outline;
    case 'ALL':
    default:
      return Icons.public;
  }
}

/// The announcements feed — a superadmin's list of business broadcasts, with
/// a `+` action in the app bar to compose a new one.
class AnnouncementsListScreen extends ConsumerWidget {
  const AnnouncementsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final listAsync = ref.watch(announcementsListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Announcements'),
        actions: [
          IconButton(
            key: const Key('newAnnouncementButton'),
            icon: const Icon(Icons.add),
            tooltip: 'New announcement',
            onPressed: () => context.push(announcementComposeRoute),
          ),
        ],
      ),
      body: listAsync.when(
        loading: () => const _AnnouncementsShimmer(),
        error: (error, stackTrace) => _AnnouncementsError(
          onRetry: () => ref.invalidate(announcementsListProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const _EmptyAnnouncements();
          }

          return RefreshIndicator(
            onRefresh: () => ref.refresh(announcementsListProvider.future),
            child: ListView.builder(
              key: const Key('announcementsListView'),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                return _AnnouncementCard(announcement: item, index: index);
              },
            ),
          );
        },
      ),
    );
  }
}

class _AudienceBadge extends StatelessWidget {
  const _AudienceBadge({required this.announcement});

  final Announcement announcement;

  @override
  Widget build(BuildContext context) {
    final color = audienceColor(announcement.audienceType);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(audienceIcon(announcement.audienceType), size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            announcement.audienceLabel,
            style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 10.5, letterSpacing: 0.2),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _AnnouncementCard extends StatelessWidget {
  const _AnnouncementCard({required this.announcement, required this.index});

  final Announcement announcement;
  final int index;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final formatter = DateFormat('yyyy-MM-dd · HH:mm');

    return Card(
      key: Key('announcementCard_${announcement.id}'),
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push(announcementDetailPath(announcement.id)),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      announcement.title,
                      style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  _AudienceBadge(announcement: announcement),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                announcement.body,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 8),
              Text(
                '${announcement.createdBy?.name ?? 'Unknown'} · ${formatter.format(announcement.createdAt)}',
                style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
            ],
          ),
        ),
      ),
    ).animate(delay: (index * 40).ms).fadeIn(duration: 280.ms, curve: Curves.easeOut).slideY(
          begin: 0.12,
          end: 0,
          duration: 280.ms,
          curve: Curves.easeOut,
        );
  }
}

class _AnnouncementsShimmer extends StatelessWidget {
  const _AnnouncementsShimmer();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = theme.colorScheme.surfaceContainerHighest;
    final highlight = theme.colorScheme.surface;

    return ListView.builder(
      key: const Key('announcementsShimmer'),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      itemCount: 6,
      itemBuilder: (context, index) => Shimmer.fromColors(
        baseColor: base,
        highlightColor: highlight,
        child: Container(
          height: 96,
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(16)),
        ),
      ),
    );
  }
}

class _AnnouncementsError extends StatelessWidget {
  const _AnnouncementsError({required this.onRetry});

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
            Text('Could not load announcements', style: theme.textTheme.titleMedium),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

class _EmptyAnnouncements extends StatelessWidget {
  const _EmptyAnnouncements();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.campaign_outlined, size: 40, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(height: 12),
            Text('No announcements yet', style: theme.textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(
              'Tap + to broadcast one',
              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}
