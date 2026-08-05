import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/storage/secure_storage.dart';
import '../../application/app_lock_controller.dart';
import '../../domain/app_lock_status.dart';
import '../app_lock_change_pin_screen.dart';
import '../app_lock_setup_screen.dart';

/// Whether biometric unlock is currently offered on this device — recomputed
/// whenever `appLockControllerProvider`'s status changes (e.g. right after a
/// PIN is first set, since `isBiometricAvailable()` also requires a PIN to
/// exist). `autoDispose` because this only matters while the Settings
/// screen holding this section is on screen.
final _biometricAvailableProvider = FutureProvider.autoDispose<bool>((ref) {
  ref.watch(appLockControllerProvider);
  return ref.read(appLockControllerProvider.notifier).isBiometricAvailable();
});

/// The persisted "use biometric unlock" preference. Not part of
/// `AppLockController`'s state (it's a passive on-device preference, not
/// something that drives lock/unlock behavior directly), so it's read
/// straight from `SecureStorage`, same as `ThemeModeController` does for
/// theme mode.
final _biometricEnabledProvider = FutureProvider.autoDispose<bool>((ref) {
  return ref.read(secureStorageProvider).getAppLockBiometricEnabled();
});

/// Drop-in Settings card for the App Lock feature — matches the
/// bordered-container convention used by `_AppearanceCard` in
/// `settings_screen.dart`. A human wires this into that screen; it isn't
/// referenced from there yet.
class AppLockSettingsSection extends ConsumerWidget {
  const AppLockSettingsSection({super.key});

  Future<void> _onToggleAppLock(BuildContext context, WidgetRef ref, bool turnOn) async {
    if (turnOn) {
      await Navigator.of(context).push<void>(
        MaterialPageRoute(builder: (_) => const AppLockSetupScreen()),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Turn off App Lock?'),
        content: const Text('You will no longer need a PIN or biometric to open the app.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Turn off'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(appLockControllerProvider.notifier).disable();
    }
  }

  void _openChangePin(BuildContext context) {
    Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => const AppLockChangePinScreen()),
    );
  }

  Future<void> _onToggleBiometric(WidgetRef ref, bool value) async {
    await ref.read(secureStorageProvider).setAppLockBiometricEnabled(value);
    ref.invalidate(_biometricEnabledProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final lockState = ref.watch(appLockControllerProvider);
    final isEnabled = lockState.status != AppLockStatus.disabled;
    final biometricAvailableAsync = ref.watch(_biometricAvailableProvider);
    final biometricEnabledAsync = ref.watch(_biometricEnabledProvider);
    final biometricAvailable = biometricAvailableAsync.valueOrNull ?? false;

    return Material(
      color: theme.cardTheme.color ?? theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
        ),
        child: Column(
          children: [
            SwitchListTile(
              key: const Key('appLockToggle'),
              secondary: const Icon(Icons.lock_outline),
              title: const Text('App Lock'),
              subtitle: const Text('Require a PIN when the app is reopened'),
              value: isEnabled,
              onChanged: (value) => _onToggleAppLock(context, ref, value),
            ),
            if (isEnabled) ...[
              const Divider(height: 1),
              ListTile(
                key: const Key('appLockChangePinTile'),
                leading: const Icon(Icons.password_outlined),
                title: const Text('Change PIN'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _openChangePin(context),
              ),
            ],
            if (isEnabled && biometricAvailable) ...[
              const Divider(height: 1),
              SwitchListTile(
                key: const Key('appLockBiometricToggle'),
                secondary: const Icon(Icons.fingerprint),
                title: const Text('Use biometric unlock'),
                subtitle: const Text('Fingerprint or face unlock, with your PIN as a fallback'),
                value: biometricEnabledAsync.valueOrNull ?? false,
                onChanged: (value) => _onToggleBiometric(ref, value),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
