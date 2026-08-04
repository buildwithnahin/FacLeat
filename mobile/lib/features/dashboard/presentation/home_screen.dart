import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/application/auth_controller.dart';
import '../application/me_provider.dart';

/// Minimal placeholder home screen — replaced by the real dashboard in a
/// later wave. Shows the logged-in user and a logout button.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final authState = ref.watch(authControllerProvider);
    final meAsync = ref.watch(meProvider);

    final fallbackUser = authState.user;

    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircleAvatar(
                radius: 36,
                backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.12),
                child: Icon(Icons.person, size: 36, color: theme.colorScheme.primary),
              ),
              const SizedBox(height: 20),
              meAsync.when(
                data: (me) => _UserInfo(name: me.name, email: me.email),
                loading: () => fallbackUser != null
                    ? _UserInfo(name: fallbackUser.name, email: fallbackUser.email)
                    : const CircularProgressIndicator(),
                error: (error, stackTrace) => fallbackUser != null
                    ? _UserInfo(name: fallbackUser.name, email: fallbackUser.email)
                    : Text(
                        'Could not load profile',
                        style: TextStyle(color: theme.colorScheme.error),
                      ),
              ),
              const SizedBox(height: 32),
              FilledButton.icon(
                key: const Key('logoutButton'),
                onPressed: () => ref.read(authControllerProvider.notifier).logout(),
                icon: const Icon(Icons.logout),
                label: const Text('Logout'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _UserInfo extends StatelessWidget {
  const _UserInfo({required this.name, required this.email});

  final String name;
  final String email;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        Text(
          'Logged in as $name',
          key: const Key('loggedInAsText'),
          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        Text(
          email,
          style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
        ),
      ],
    );
  }
}
