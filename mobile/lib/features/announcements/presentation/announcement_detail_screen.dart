import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';

import '../application/announcements_providers.dart';
import '../domain/announcement.dart';
import 'announcements_list_screen.dart' show audienceColor, audienceIcon;

/// Human-readable file size (`142 KB`, `3.4 MB`, ...) for an attachment row.
String _formatBytes(int bytes) {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  var size = bytes.toDouble();
  var unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  final formatted = unitIndex == 0 ? size.toStringAsFixed(0) : size.toStringAsFixed(1);
  return '$formatted ${units[unitIndex]}';
}

/// Best-effort file-type icon derived from an attachment's MIME type.
IconData _fileIcon(String mimeType) {
  if (mimeType.startsWith('image/')) return Icons.image_outlined;
  if (mimeType.startsWith('video/')) return Icons.videocam_outlined;
  if (mimeType.startsWith('audio/')) return Icons.audiotrack_outlined;
  if (mimeType == 'application/pdf') return Icons.picture_as_pdf_outlined;
  if (mimeType.contains('spreadsheet') || mimeType.contains('excel')) {
    return Icons.table_chart_outlined;
  }
  if (mimeType.contains('word') || mimeType.contains('document')) {
    return Icons.description_outlined;
  }
  if (mimeType.contains('zip') || mimeType.contains('compressed')) {
    return Icons.folder_zip_outlined;
  }
  return Icons.insert_drive_file_outlined;
}

class AnnouncementDetailScreen extends ConsumerWidget {
  const AnnouncementDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(announcementDetailProvider(id));

    return Scaffold(
      appBar: AppBar(title: const Text('Announcement')),
      body: detailAsync.when(
        loading: () => const _AnnouncementDetailShimmer(),
        error: (error, stackTrace) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.error_outline, size: 40, color: Theme.of(context).colorScheme.error),
                const SizedBox(height: 12),
                const Text('Could not load this announcement'),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => ref.invalidate(announcementDetailProvider(id)),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (announcement) => _AnnouncementDetailBody(announcement: announcement),
      ),
    );
  }
}

class _AnnouncementDetailBody extends StatelessWidget {
  const _AnnouncementDetailBody({required this.announcement});

  final Announcement announcement;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final formatter = DateFormat('yyyy-MM-dd · HH:mm');
    final color = audienceColor(announcement.audienceType);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          announcement.title,
          key: const Key('announcementDetailTitle'),
          style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        ).animate().fadeIn(duration: 300.ms).slideY(begin: 0.08, end: 0),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(audienceIcon(announcement.audienceType), size: 14, color: color),
              const SizedBox(width: 6),
              Text(
                announcement.audienceLabel,
                style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12, letterSpacing: 0.2),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _DetailSection(
          title: 'Message',
          children: [
            Text(
              announcement.body,
              key: const Key('announcementDetailBody'),
              style: theme.textTheme.bodyMedium,
            ),
          ],
        ),
        const SizedBox(height: 16),
        _DetailSection(
          title: 'Details',
          children: [
            _DetailRow(
              icon: Icons.person_outline,
              label: 'Sent by',
              value: announcement.createdBy?.name ?? 'Unknown',
            ),
            _DetailRow(
              icon: Icons.schedule,
              label: 'Sent',
              value: formatter.format(announcement.createdAt),
            ),
          ],
        ),
        if (announcement.attachments.isNotEmpty) ...[
          const SizedBox(height: 16),
          _DetailSection(
            title: 'Attachments',
            children: [
              for (final attachment in announcement.attachments)
                _AttachmentRow(attachment: attachment),
            ],
          ),
        ],
      ],
    );
  }
}

class _AttachmentRow extends StatelessWidget {
  const _AttachmentRow({required this.attachment});

  final AnnouncementAttachment attachment;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      key: Key('attachmentRow_${attachment.id}'),
      borderRadius: BorderRadius.circular(10),
      onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Attachment preview is not available yet')),
        );
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Icon(_fileIcon(attachment.mimeType), size: 20, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                attachment.originalName,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodyMedium,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              _formatBytes(attachment.size),
              style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: 10),
          Expanded(
            child: Text(label, style: theme.textTheme.bodyMedium),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _AnnouncementDetailShimmer extends StatelessWidget {
  const _AnnouncementDetailShimmer();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = theme.colorScheme.surfaceContainerHighest;
    final highlight = theme.colorScheme.surface;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        for (var i = 0; i < 4; i++)
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
