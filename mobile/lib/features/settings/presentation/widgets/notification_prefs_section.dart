import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/notification_prefs_provider.dart';

const List<(String severity, String label)> _severities = [
  ('INFO', 'Info'),
  ('WARNING', 'Warning'),
  ('CRITICAL', 'Critical'),
];

/// Card for the Settings screen controlling local sound/vibration feedback
/// on live (SSE) notifications, and which severities are muted from that
/// feedback. Matches the border/padding/rounded-corner convention of
/// `_AppearanceCard` in settings_screen.dart.
class NotificationPrefsSection extends ConsumerWidget {
  const NotificationPrefsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final prefs = ref.watch(notificationPrefsProvider);
    final controller = ref.read(notificationPrefsProvider.notifier);

    return Material(
      color: theme.cardTheme.color ?? theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SwitchListTile.adaptive(
              key: const Key('notifSoundSwitch'),
              contentPadding: EdgeInsets.zero,
              title: const Text('Sound'),
              subtitle: const Text('Play a sound when a new alert arrives'),
              value: prefs.soundEnabled,
              onChanged: (value) => controller.setSoundEnabled(value),
            ),
            SwitchListTile.adaptive(
              key: const Key('notifVibrateSwitch'),
              contentPadding: EdgeInsets.zero,
              title: const Text('Vibrate'),
              subtitle: const Text('Vibrate when a new alert arrives'),
              value: prefs.vibrateEnabled,
              onChanged: (value) => controller.setVibrateEnabled(value),
            ),
            const Divider(height: 24),
            Text('Mute alerts for', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(
              'Muted severities are still delivered, just without sound/vibration',
              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final (severity, label) in _severities)
                  FilterChip(
                    key: Key('notifMuteChip_$severity'),
                    label: Text(label),
                    selected: prefs.mutedSeverities.contains(severity),
                    onSelected: (muted) => controller.setSeverityMuted(severity, muted),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
