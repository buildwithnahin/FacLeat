// Widget tests for the Annex Admin mobile app foundation.
//
// Covers:
//  - LoginScreen renders its email/password fields and sign-in button.
//  - AppTheme's light/dark ColorScheme.primary matches the brand blue.

import 'package:annex_mobile/core/theme/app_colors.dart';
import 'package:annex_mobile/core/theme/app_theme.dart';
import 'package:annex_mobile/features/auth/presentation/login_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('LoginScreen renders email, password fields and sign-in button',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: LoginScreen(),
        ),
      ),
    );
    // Let the entrance animation (flutter_animate) run to completion so no
    // timers are left pending when the test tears down.
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('emailField')), findsOneWidget);
    expect(find.byKey(const Key('passwordField')), findsOneWidget);
    expect(find.byKey(const Key('signInButton')), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
    expect(find.text('Annex Admin'), findsOneWidget);
  });

  testWidgets('AppTheme primary color matches the brand blue (#2563EB)',
      (WidgetTester tester) async {
    expect(AppTheme.light.colorScheme.primary, AppColors.primary);
    expect(AppTheme.dark.colorScheme.primary, AppColors.primary);
    expect(AppColors.primary, const Color(0xFF2563EB));

    // Sanity check the theme actually resolves through a real widget tree.
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Builder(
          builder: (context) {
            expect(Theme.of(context).colorScheme.primary, const Color(0xFF2563EB));
            return const SizedBox.shrink();
          },
        ),
      ),
    );
  });
}
