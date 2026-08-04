import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/auth_controller.dart';
import '../../features/dashboard/application/me_provider.dart';
import '../router/app_router.dart';
import '../theme/app_colors.dart';
import '../theme/theme_mode_controller.dart';

/// Secondary navigation: profile summary, theme choice, and logout. Primary
/// navigation (Roles/Users/Reports/Audit/Home) lives in the bottom nav bar —
/// this drawer is for things that don't need their own bottom-nav slot.
class AppDrawer extends ConsumerWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final meAsync = ref.watch(meProvider);
    final authState = ref.watch(authControllerProvider);
    final mode = ref.watch(themeModeProvider);

    final name = meAsync.valueOrNull?.name ?? authState.user?.name ?? 'Admin';
    final email = meAsync.valueOrNull?.email ?? authState.user?.email ?? '';
    final initials = name.trim().isEmpty
        ? '?'
        : name.trim().split(RegExp(r'\s+')).take(2).map((w) => w[0].toUpperCase()).join();

    return Drawer(
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InkWell(
              key: const Key('drawerProfileTile'),
              onTap: () {
                Navigator.of(context).pop();
                context.push(settingsRoute);
              },
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 26,
                      backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                      child: Text(
                        initials,
                        style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700, fontSize: 18),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                          Text(
                            email,
                            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Text(
                              'SUPER ADMIN',
                              style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700, fontSize: 10, letterSpacing: 0.4),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(Icons.chevron_right, color: theme.colorScheme.onSurfaceVariant),
                  ],
                ),
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Text(
                'APPEARANCE',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  letterSpacing: 0.6,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: SegmentedButton<ThemeMode>(
                key: const Key('themeModeSegmentedButton'),
                segments: const [
                  ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode_outlined), label: Text('Light')),
                  ButtonSegment(value: ThemeMode.system, icon: Icon(Icons.brightness_auto_outlined), label: Text('Auto')),
                  ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode_outlined), label: Text('Dark')),
                ],
                selected: {mode},
                onSelectionChanged: (selection) =>
                    ref.read(themeModeProvider.notifier).setThemeMode(selection.first),
                showSelectedIcon: false,
              ),
            ),
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  const SizedBox(height: 8),
                  _SectionHeader(label: 'WORKSPACE'),
                  _DrawerTile(
                    icon: Icons.apartment_outlined,
                    label: 'Companies',
                    onTap: () {
                      Navigator.of(context).pop();
                      context.push(companiesRoute);
                    },
                  ).animate(delay: 40.ms).fadeIn(duration: 250.ms).slideX(begin: 0.08, end: 0, duration: 250.ms, curve: Curves.easeOut),
                  _DrawerTile(
                    icon: Icons.store_mall_directory_outlined,
                    label: 'Branches',
                    onTap: () {
                      Navigator.of(context).pop();
                      context.push(branchesRoute);
                    },
                  ).animate(delay: 80.ms).fadeIn(duration: 250.ms).slideX(begin: 0.08, end: 0, duration: 250.ms, curve: Curves.easeOut),
                  const SizedBox(height: 8),
                  _SectionHeader(label: 'SUPPORT'),
                  _DrawerTile(
                    icon: Icons.info_outline,
                    label: 'About Annex Admin',
                    onTap: () {
                      Navigator.of(context).pop();
                      showAboutDialog(
                        context: context,
                        applicationName: 'Annex Admin',
                        applicationVersion: 'v1.0.0',
                        applicationIcon: const Icon(Icons.shield_outlined, color: AppColors.primary, size: 32),
                        children: const [
                          Text('Superadmin console for the DeshIT-BD SME ERP — manage roles, permissions, and view every report.'),
                        ],
                      );
                    },
                  ).animate(delay: 120.ms).fadeIn(duration: 250.ms).slideX(begin: 0.08, end: 0, duration: 250.ms, curve: Curves.easeOut),
                  _DrawerTile(
                    icon: Icons.support_agent_outlined,
                    label: 'Help & Support',
                    onTap: () {
                      Navigator.of(context).pop();
                      showDialog<void>(
                        context: context,
                        builder: (dialogContext) => AlertDialog(
                          title: const Text('Help & Support'),
                          content: const Text(
                            'For account, permission, or data issues, contact your system administrator or reach the DeshIT-BD support team through the web console.',
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.of(dialogContext).pop(),
                              child: const Text('Close'),
                            ),
                          ],
                        ),
                      );
                    },
                  ).animate(delay: 160.ms).fadeIn(duration: 250.ms).slideX(begin: 0.08, end: 0, duration: 250.ms, curve: Curves.easeOut),
                ],
              ),
            ),
            const Divider(height: 1),
            ListTile(
              key: const Key('drawerLogoutTile'),
              leading: const Icon(Icons.logout, color: AppColors.danger),
              title: const Text('Logout', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
              onTap: () {
                Navigator.of(context).pop();
                ref.read(authControllerProvider.notifier).logout();
              },
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
              child: Text(
                'Annex Admin · v1.0.0',
                style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
      child: Text(
        label,
        style: theme.textTheme.labelSmall?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
          letterSpacing: 0.6,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _DrawerTile extends StatelessWidget {
  const _DrawerTile({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      key: Key('drawerTile_$label'),
      dense: true,
      leading: Icon(icon, color: Theme.of(context).colorScheme.onSurfaceVariant),
      title: Text(label, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
      onTap: onTap,
    );
  }
}
