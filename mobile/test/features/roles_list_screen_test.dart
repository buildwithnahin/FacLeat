// Verifies RolesListScreen shows the shimmer skeleton while rolesListProvider
// is pending, then swaps to the real list once the future resolves — without
// making any real network call (the provider is overridden directly).

import 'dart:async';

import 'package:annex_mobile/features/roles/application/roles_providers.dart';
import 'package:annex_mobile/features/roles/domain/role.dart';
import 'package:annex_mobile/features/roles/presentation/roles_list_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows shimmer while loading, then renders roles once resolved', (tester) async {
    final completer = Completer<List<MobileRole>>();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          rolesListProvider.overrideWith((ref) => completer.future),
        ],
        child: const MaterialApp(home: RolesListScreen()),
      ),
    );

    // First frame: the future hasn't resolved yet, so the shimmer skeleton
    // should be showing and no real role data should be rendered.
    await tester.pump();
    expect(find.byKey(const Key('rolesListShimmer')), findsOneWidget);
    expect(find.byKey(const Key('rolesListView')), findsNothing);
    expect(find.text('Branch Manager'), findsNothing);

    completer.complete(const [
      MobileRole(id: 'r1', name: 'Branch Manager', isSystem: false, userCount: 3),
      MobileRole(id: 'r2', name: 'Super Admin', isSystem: true, userCount: 1),
    ]);
    await tester.pumpAndSettle();

    // After resolution: shimmer is gone, real data is shown.
    expect(find.byKey(const Key('rolesListShimmer')), findsNothing);
    expect(find.byKey(const Key('rolesListView')), findsOneWidget);
    expect(find.text('Branch Manager'), findsOneWidget);
    expect(find.text('Super Admin'), findsOneWidget);
    expect(find.text('SYSTEM'), findsOneWidget); // only the system role gets the badge
  });

  testWidgets('shows a retry button when the roles future fails', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          rolesListProvider.overrideWith((ref) => Future<List<MobileRole>>.error('network down')),
        ],
        child: const MaterialApp(home: RolesListScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Could not load roles'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Retry'), findsOneWidget);
  });
}
