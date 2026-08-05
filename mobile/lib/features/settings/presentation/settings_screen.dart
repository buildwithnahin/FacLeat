import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/theme_mode_controller.dart';
import '../../app_lock/presentation/widgets/app_lock_settings_section.dart';
import '../../auth/application/auth_controller.dart';
import '../../dashboard/application/me_provider.dart';
import '../application/settings_providers.dart';
import '../domain/mobile_session.dart';
import 'widgets/language_section.dart';
import 'widgets/notification_prefs_section.dart';

/// Full account-settings screen — profile detail, appearance, and active
/// session management. Distinct from the drawer's inline appearance toggle
/// (which stays for one-tap access); this is where the fuller controls live,
/// including revoking other devices' sessions via the real
/// `MobileRefreshToken` backend that Wave 1 built but no screen used yet.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meAsync = ref.watch(meProvider);
    final authState = ref.watch(authControllerProvider);
    final mode = ref.watch(themeModeProvider);

    final name = meAsync.valueOrNull?.name ?? authState.user?.name ?? 'Admin';
    final email = meAsync.valueOrNull?.email ?? authState.user?.email ?? '';
    final roles = meAsync.valueOrNull?.roles ?? const <String>[];
    final permissionCount = meAsync.valueOrNull?.permissions.length ?? 0;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        key: const Key('settingsScreenList'),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          _ProfileCard(name: name, email: email, roles: roles, permissionCount: permissionCount),
          const SizedBox(height: 24),
          const _SectionLabel(label: 'Appearance', icon: Icons.palette_outlined),
          const SizedBox(height: 10),
          _AppearanceCard(mode: mode, ref: ref),
          const SizedBox(height: 24),
          const _SectionLabel(label: 'Security', icon: Icons.shield_outlined),
          const SizedBox(height: 10),
          _ChangePasswordCard(onTap: () => context.push(changePasswordRoute)),
          const SizedBox(height: 12),
          const AppLockSettingsSection(),
          const SizedBox(height: 24),
          const _SectionLabel(label: 'Notifications', icon: Icons.notifications_outlined),
          const SizedBox(height: 10),
          const NotificationPrefsSection(),
          const SizedBox(height: 24),
          const _SectionLabel(label: 'Language', icon: Icons.translate_outlined),
          const SizedBox(height: 10),
          const LanguageSection(),
          const SizedBox(height: 24),
          const _SectionLabel(label: 'Active sessions', icon: Icons.devices_outlined),
          const SizedBox(height: 10),
          const _SessionsSection(),
          const SizedBox(height: 24),
          _LogoutButton(ref: ref),
        ],
      ),
    );
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.name, required this.email, required this.roles, required this.permissionCount});

  final String name;
  final String email;
  final List<String> roles;
  final int permissionCount;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final initials = name.trim().isEmpty
        ? '?'
        : name.trim().split(RegExp(r'\s+')).take(2).map((w) => w[0].toUpperCase()).join();

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primary.withValues(alpha: 0.16), AppColors.primary.withValues(alpha: 0.04)],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.18)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: AppColors.primary.withValues(alpha: 0.18),
            child: Text(
              initials,
              style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 20),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                Text(email, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final role in roles) _Chip(label: role),
                    _Chip(label: '$permissionCount permissions'),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 300.ms).slideY(begin: -0.06, end: 0, duration: 300.ms, curve: Curves.easeOutCubic);
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700, fontSize: 10.5, letterSpacing: 0.3),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Icon(icon, size: 18, color: theme.colorScheme.onSurfaceVariant),
        const SizedBox(width: 8),
        Text(label, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
      ],
    );
  }
}

class _AppearanceCard extends StatelessWidget {
  const _AppearanceCard({required this.mode, required this.ref});

  final ThemeMode mode;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardTheme.color ?? theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
      ),
      child: SegmentedButton<ThemeMode>(
        key: const Key('settingsThemeModeSegmentedButton'),
        segments: const [
          ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode_outlined), label: Text('Light')),
          ButtonSegment(value: ThemeMode.system, icon: Icon(Icons.brightness_auto_outlined), label: Text('Auto')),
          ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode_outlined), label: Text('Dark')),
        ],
        selected: {mode},
        onSelectionChanged: (selection) => ref.read(themeModeProvider.notifier).setThemeMode(selection.first),
        showSelectedIcon: false,
      ),
    );
  }
}

class _ChangePasswordCard extends StatelessWidget {
  const _ChangePasswordCard({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: theme.cardTheme.color ?? theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
        ),
        child: ListTile(
          key: const Key('changePasswordTile'),
          leading: const Icon(Icons.password_outlined),
          title: const Text('Change password'),
          trailing: const Icon(Icons.chevron_right),
          onTap: onTap,
        ),
      ),
    );
  }
}

class _SessionsSection extends ConsumerWidget {
  const _SessionsSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionsAsync = ref.watch(sessionsProvider);
    final theme = Theme.of(context);

    return sessionsAsync.when(
      loading: () => Shimmer.fromColors(
        baseColor: theme.colorScheme.surfaceContainerHighest,
        highlightColor: theme.colorScheme.surface,
        child: Container(
          height: 140,
          decoration: BoxDecoration(
            color: theme.colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      error: (error, stackTrace) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.danger.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            const Icon(Icons.error_outline, color: AppColors.danger),
            const SizedBox(width: 10),
            Expanded(child: Text('Could not load sessions', style: theme.textTheme.bodySmall)),
            TextButton(
              onPressed: () => ref.invalidate(sessionsProvider),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (sessions) {
        if (sessions.isEmpty) {
          return Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: theme.cardTheme.color ?? theme.colorScheme.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
            ),
            child: Text('No active sessions', style: theme.textTheme.bodySmall),
          );
        }
        return Container(
          decoration: BoxDecoration(
            color: theme.cardTheme.color ?? theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
          ),
          child: Column(
            key: const Key('sessionsList'),
            children: [
              for (var i = 0; i < sessions.length; i++) ...[
                if (i > 0) const Divider(height: 1),
                _SessionRow(session: sessions[i]),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _SessionRow extends ConsumerWidget {
  const _SessionRow({required this.session});

  final MobileSessionInfo session;

  Future<void> _confirmRevoke(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Revoke this session?'),
        content: const Text('If this is the device you\'re using right now, you\'ll be signed out immediately.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Revoke'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await revokeMobileSession(ref, session.id);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final formatter = DateFormat('yyyy-MM-dd · HH:mm');

    return ListTile(
      key: Key('sessionRow_${session.id}'),
      leading: const Icon(Icons.smartphone_outlined),
      title: Text(
        session.deviceLabel?.isNotEmpty == true ? session.deviceLabel! : 'Unknown device',
        style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
      ),
      subtitle: Text(
        'Signed in ${formatter.format(session.createdAt)}',
        style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
      ),
      trailing: IconButton(
        key: Key('revokeSessionButton_${session.id}'),
        icon: const Icon(Icons.logout, color: AppColors.danger),
        tooltip: 'Revoke session',
        onPressed: () => _confirmRevoke(context, ref),
      ),
    );
  }
}

class _LogoutButton extends StatelessWidget {
  const _LogoutButton({required this.ref});

  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        key: const Key('settingsLogoutButton'),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.danger,
          side: const BorderSide(color: AppColors.danger),
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
        onPressed: () => ref.read(authControllerProvider.notifier).logout(),
        icon: const Icon(Icons.logout),
        label: const Text('Logout'),
      ),
    );
  }
}
