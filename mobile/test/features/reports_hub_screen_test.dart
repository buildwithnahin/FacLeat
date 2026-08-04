// Verifies ReportsHubScreen renders all three category sections (General,
// Financials, HR) with the expected report entries from the static catalog.
// The hub screen reads no providers/network — it's purely static catalog
// data — so no overrides are needed here.

import 'package:annex_mobile/features/reports/presentation/reports_hub_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  // The full report catalog is taller than the default 800x600 test
  // surface, and this screen's ListView doesn't build offscreen children.
  // Use a tall surface so every section is laid out and findable without
  // needing to scroll mid-test.
  setUp(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.physicalSize = const Size(800, 2600);
    binding.platformDispatcher.views.first.devicePixelRatio = 1.0;
    addTearDown(binding.platformDispatcher.views.first.resetPhysicalSize);
    addTearDown(binding.platformDispatcher.views.first.resetDevicePixelRatio);
  });

  Widget wrap() {
    final router = GoRouter(
      initialLocation: '/reports',
      routes: [
        GoRoute(path: '/reports', builder: (context, state) => const ReportsHubScreen()),
        GoRoute(path: '/reports/general/:type', builder: (context, state) => const SizedBox()),
        GoRoute(path: '/reports/financials/:type', builder: (context, state) => const SizedBox()),
        GoRoute(path: '/reports/hr/:category/:type', builder: (context, state) => const SizedBox()),
      ],
    );
    return ProviderScope(child: MaterialApp.router(routerConfig: router));
  }

  testWidgets('renders General, Financials, and HR sections with their entries', (tester) async {
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('section_general')), findsOneWidget);
    expect(find.byKey(const Key('section_financials')), findsOneWidget);
    expect(find.byKey(const Key('section_hr')), findsOneWidget);

    // A couple of representative entries from each category.
    expect(find.text('Sales Summary'), findsOneWidget);
    expect(find.text('Top Products'), findsOneWidget);
    expect(find.text('Trial Balance'), findsOneWidget);
    expect(find.text('Balance Sheet'), findsOneWidget);
    expect(find.text('Payroll'), findsOneWidget);
    expect(find.text('Attendance'), findsOneWidget);
  });

  testWidgets('tapping an HR category opens a bottom sheet with its report types', (tester) async {
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('reportTile_Payroll')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('hrSheetList_payroll')), findsOneWidget);
    expect(find.text('Payroll Summary'), findsOneWidget);
    expect(find.text('Salary Register'), findsOneWidget);
  });

  testWidgets('tapping a general report tile navigates to the report detail route', (tester) async {
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('reportTile_Sales Summary')));
    await tester.pumpAndSettle();

    // The stub route for reportsGeneralRoute renders an empty SizedBox, so
    // reaching this point without error confirms the go_router push worked.
    expect(find.byKey(const Key('reportsHubList')), findsNothing);
  });
}
