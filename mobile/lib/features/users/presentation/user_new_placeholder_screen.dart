import 'package:flutter/material.dart';

/// Placeholder for `userNewRoute`.
///
/// Full user creation requires picking an unlinked [Employee], a role, a
/// branch-access mode (all / assigned / own-branch-only), and a password —
/// see `POST /api/mobile/users` / `userCreateSchema` in the backend. That
/// multi-step picker flow was deliberately out of scope for this pass (see
/// task notes); list + detail + status toggle + the role permission matrix
/// were prioritized instead. This screen exists only so `userNewRoute` is a
/// valid, non-crashing destination.
class UserNewPlaceholderScreen extends StatelessWidget {
  const UserNewPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('New user')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.construction_outlined, size: 40, color: theme.colorScheme.onSurfaceVariant),
              const SizedBox(height: 16),
              Text(
                'User creation coming soon',
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Creating a user requires linking an employee record, a role, '
                'and a branch-access mode. Use the web admin app for now.',
                style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
