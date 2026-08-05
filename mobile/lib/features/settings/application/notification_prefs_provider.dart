import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/secure_storage.dart';

/// The three local (client-side only — there is no backend model for these)
/// notification-feedback preferences: whether a live SSE notification plays
/// a sound / vibrates, and which severities are muted from that feedback
/// (the notification itself is still delivered and shown either way).
class NotificationPrefs {
  const NotificationPrefs({
    required this.soundEnabled,
    required this.vibrateEnabled,
    required this.mutedSeverities,
  });

  const NotificationPrefs.defaults()
      : soundEnabled = true,
        vibrateEnabled = true,
        mutedSeverities = const {};

  final bool soundEnabled;
  final bool vibrateEnabled;
  final Set<String> mutedSeverities;

  NotificationPrefs copyWith({
    bool? soundEnabled,
    bool? vibrateEnabled,
    Set<String>? mutedSeverities,
  }) {
    return NotificationPrefs(
      soundEnabled: soundEnabled ?? this.soundEnabled,
      vibrateEnabled: vibrateEnabled ?? this.vibrateEnabled,
      mutedSeverities: mutedSeverities ?? this.mutedSeverities,
    );
  }
}

/// Holds [NotificationPrefs], restoring persisted values from
/// [SecureStorage] on start and writing through on every change — mirrors
/// [ThemeModeController]'s restore-then-write-through pattern.
class NotificationPrefsController extends Notifier<NotificationPrefs> {
  @override
  NotificationPrefs build() {
    unawaited(_restore());
    return const NotificationPrefs.defaults();
  }

  Future<void> _restore() async {
    final storage = ref.read(secureStorageProvider);
    final sound = await storage.getNotifSoundEnabled();
    final vibrate = await storage.getNotifVibrateEnabled();
    final muted = await storage.getNotifMutedSeverities();
    state = NotificationPrefs(
      soundEnabled: sound,
      vibrateEnabled: vibrate,
      mutedSeverities: muted,
    );
  }

  Future<void> setSoundEnabled(bool value) async {
    state = state.copyWith(soundEnabled: value);
    await ref.read(secureStorageProvider).setNotifSoundEnabled(value);
  }

  Future<void> setVibrateEnabled(bool value) async {
    state = state.copyWith(vibrateEnabled: value);
    await ref.read(secureStorageProvider).setNotifVibrateEnabled(value);
  }

  /// Toggles whether [severity] (`'INFO'|'WARNING'|'CRITICAL'`) is muted.
  Future<void> setSeverityMuted(String severity, bool muted) async {
    final updated = Set<String>.from(state.mutedSeverities);
    if (muted) {
      updated.add(severity);
    } else {
      updated.remove(severity);
    }
    state = state.copyWith(mutedSeverities: updated);
    await ref.read(secureStorageProvider).setNotifMutedSeverities(updated);
  }
}

final NotifierProvider<NotificationPrefsController, NotificationPrefs> notificationPrefsProvider =
    NotifierProvider<NotificationPrefsController, NotificationPrefs>(NotificationPrefsController.new);
