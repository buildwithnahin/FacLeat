// Verifies HomeScreen renders the KPI grid, system health banner, branch
// strip, and recent-activity feed from fake completed provider futures — no
// real network call is made (every backing provider is overridden).

import 'package:annex_mobile/features/audit/domain/audit_entry.dart';
import 'package:annex_mobile/features/dashboard/application/dashboard_provider.dart';
import 'package:annex_mobile/features/dashboard/application/me_provider.dart';
import 'package:annex_mobile/features/dashboard/presentation/home_screen.dart';
import 'package:annex_mobile/features/reports/application/report_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

const _summary = DashboardSummary(
  totalCompanies: 1,
  totalBranches: 5,
  totalUsers: 9,
  activeModules: 26,
  systemHealth: 'Healthy',
  todayLoginUsers: 3,
  pendingApprovals: 2,
  lowStockProducts: 4,
  activeProducts: 31,
  totalSales: 210035,
  totalPurchases: 1434514,
  revenue: 210035,
  outstandingPayments: 36222,
  pendingOrders: 7,
  employeeAttendance: 92.3,
);

const _me = MeProfile(id: 'u1', email: 'admin@annex.local', name: 'Admin User');

const _branches = [
  BranchOption(id: 'b1', name: 'Headquarters', code: 'HQ'),
  BranchOption(id: 'b2', name: 'Dhaka Showroom', code: 'DHK'),
];

Widget _wrap() {
  final router = GoRouter(
    initialLocation: '/home',
    routes: [
      GoRoute(path: '/home', builder: (context, state) => const HomeScreen()),
      GoRoute(path: '/roles', builder: (context, state) => const SizedBox()),
      GoRoute(path: '/users', builder: (context, state) => const SizedBox()),
      GoRoute(path: '/reports', builder: (context, state) => const SizedBox()),
      GoRoute(path: '/audit', builder: (context, state) => const SizedBox()),
      GoRoute(path: '/approvals', builder: (context, state) => const SizedBox()),
      GoRoute(path: '/branch-monitoring', builder: (context, state) => const SizedBox()),
      GoRoute(
        path: '/reports/general/:type',
        builder: (context, state) => const SizedBox(),
      ),
      GoRoute(
        path: '/reports/financials/:type',
        builder: (context, state) => const SizedBox(),
      ),
      GoRoute(
        path: '/reports/hr/:category/:type',
        builder: (context, state) => const SizedBox(),
      ),
    ],
  );
  return ProviderScope(
    overrides: [
      dashboardProvider.overrideWith((ref) async => _summary),
      meProvider.overrideWith((ref) async => _me),
      branchesProvider.overrideWith((ref) async => _branches),
      recentActivityProvider.overrideWith((ref) async => const <AuditEntry>[]),
    ],
    child: MaterialApp.router(routerConfig: router),
  );
}

void main() {
  // HomeScreen's content is taller than the default 800x600 test surface,
  // and its ListView doesn't build offscreen children. Use a tall surface so
  // every section is laid out and findable without needing to scroll.
  setUp(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.physicalSize = const Size(800, 2600);
    binding.platformDispatcher.views.first.devicePixelRatio = 1.0;
    addTearDown(binding.platformDispatcher.views.first.resetPhysicalSize);
    addTearDown(binding.platformDispatcher.views.first.resetDevicePixelRatio);
  });

  // HomeScreen has one intentionally-infinite animation (the pulsing system
  // health dot, `.animate(...).repeat(reverse: true)`), so `pumpAndSettle`
  // never quiesces here. Flush the override futures with a zero-duration
  // pump, then advance the clock far enough for the one-shot entrance
  // animations (fade/slide, ~1.3s worst case) to finish in a single frame.
  Future<void> pumpUntilLoaded(WidgetTester tester) async {
    await tester.pumpWidget(_wrap());
    await tester.pump(); // build + start override futures
    await tester.pump(); // let the futures resolve
    await tester.pump(const Duration(seconds: 2)); // settle one-shot entrance animations
  }

  testWidgets('HomeScreen shows KPI cards with animated values reaching the fetched totals', (tester) async {
    await pumpUntilLoaded(tester);

    // Two distinct grids now exist: the Business KPI grid (kpiGrid) and the
    // System KPI grid (systemKpiGrid) below it.
    expect(find.byKey(const Key('kpiGrid')), findsOneWidget);
    expect(find.byKey(const Key('systemKpiGrid')), findsOneWidget);
    expect(find.byKey(const Key('kpiValue_Branches')), findsOneWidget);
    expect(find.text('5'), findsOneWidget); // Branches count-up settled value
    expect(find.text('9'), findsOneWidget); // Users
    expect(find.text('26'), findsOneWidget); // Active modules

    expect(find.byKey(const Key('systemHealthBanner')), findsOneWidget);
    expect(find.text('Healthy'), findsOneWidget);

    // Greeting header shows the user's first name.
    expect(find.text('Admin'), findsOneWidget);
  });

  testWidgets('HomeScreen renders the Business KPI grid with money formatting and a percentage suffix', (
    tester,
  ) async {
    await pumpUntilLoaded(tester);

    final businessGrid = find.byKey(const Key('kpiGrid'));
    final systemGrid = find.byKey(const Key('systemKpiGrid'));
    expect(businessGrid, findsOneWidget);
    expect(systemGrid, findsOneWidget);

    // `kpiGrid` must resolve to the Business grid specifically — it holds
    // "Total sales", not "Branches" (which lives in the System grid).
    expect(find.descendant(of: businessGrid, matching: find.text('Total sales')), findsOneWidget);
    expect(find.descendant(of: businessGrid, matching: find.text('Branches')), findsNothing);
    expect(find.descendant(of: systemGrid, matching: find.text('Branches')), findsOneWidget);
    expect(find.descendant(of: systemGrid, matching: find.text('Total sales')), findsNothing);

    // Money cards use `NumberFormat.decimalPattern()` comma-grouping via
    // KpiCard's `valueFormatter`. Total sales and Revenue share the fixture
    // value (210035), so the formatted string appears twice.
    final moneyFormat = NumberFormat.decimalPattern();
    expect(moneyFormat.format(210035), '210,035');
    expect(moneyFormat.format(1434514), '1,434,514');
    expect(moneyFormat.format(36222), '36,222');

    expect(find.text(moneyFormat.format(210035)), findsNWidgets(2)); // Total sales + Revenue
    expect(find.text(moneyFormat.format(1434514)), findsOneWidget); // Total purchases
    expect(find.text(moneyFormat.format(36222)), findsOneWidget); // Outstanding payments

    // Employee attendance (92.3) rounds and gets the '%' suffix appended.
    expect(find.text('92%'), findsOneWidget);
  });

  testWidgets('HomeScreen renders the branch strip and recent-activity sections', (tester) async {
    await pumpUntilLoaded(tester);

    expect(find.byKey(const Key('branchesStrip')), findsOneWidget);
    expect(find.text('Headquarters'), findsOneWidget);
    expect(find.text('Dhaka Showroom'), findsOneWidget);

    expect(find.byKey(const Key('recentActivityCard')), findsOneWidget);
    expect(find.text('No activity yet'), findsOneWidget);
  });
}
