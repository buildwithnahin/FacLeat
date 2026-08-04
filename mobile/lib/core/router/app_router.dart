import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/auth_controller.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/dashboard/presentation/home_screen.dart';
import '../../features/roles/presentation/role_form_screen.dart';
import '../../features/roles/presentation/roles_list_screen.dart';
import '../../features/users/presentation/user_detail_screen.dart';
import '../../features/users/presentation/user_new_placeholder_screen.dart';
import '../../features/users/presentation/users_list_screen.dart';
import '../../features/audit/presentation/audit_detail_screen.dart';
import '../../features/audit/presentation/audit_list_screen.dart';
import '../../features/reports/application/report_provider.dart';
import '../../features/reports/data/report_catalog.dart';
import '../../features/reports/presentation/report_detail_screen.dart';
import '../../features/reports/presentation/reports_hub_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../../features/workspace/presentation/branches_screen.dart';
import '../../features/workspace/presentation/companies_screen.dart';
import 'main_shell.dart';

const String splashRoute = '/splash';
const String loginRoute = '/login';
const String homeRoute = '/home';
const String rolesRoute = '/roles';
const String roleNewRoute = '/roles/new';
const String roleDetailRoute = '/roles/:id';
const String usersRoute = '/users';
const String userNewRoute = '/users/new';
const String userDetailRoute = '/users/:id';
const String reportsHubRoute = '/reports';
const String reportsGeneralRoute = '/reports/general/:type';
const String reportsFinancialsRoute = '/reports/financials/:type';
const String reportsHrRoute = '/reports/hr/:category/:type';
const String auditRoute = '/audit';
const String auditDetailRoute = '/audit/:id';
const String companiesRoute = '/companies';
const String branchesRoute = '/branches';
const String settingsRoute = '/settings';

String roleDetailPath(String id) => '/roles/$id';
String userDetailPath(String id) => '/users/$id';
String reportsGeneralPath(String type) => '/reports/general/$type';
String reportsFinancialsPath(String type) => '/reports/financials/$type';
String reportsHrPath(String category, String type) => '/reports/hr/$category/$type';
String auditDetailPath(String id) => '/audit/$id';

/// Bridges Riverpod's [authControllerProvider] to go_router's
/// [Listenable]-based `refreshListenable`, so the router re-evaluates
/// [GoRouter.redirect] whenever the auth status changes.
class _RouterRefreshNotifier extends ChangeNotifier {
  _RouterRefreshNotifier(Ref ref) {
    ref.listen<AuthState>(authControllerProvider, (previous, next) {
      if (previous?.status != next.status) {
        notifyListeners();
      }
    });
  }
}

final Provider<GoRouter> appRouterProvider = Provider<GoRouter>((ref) {
  final refreshNotifier = _RouterRefreshNotifier(ref);

  return GoRouter(
    initialLocation: splashRoute,
    refreshListenable: refreshNotifier,
    redirect: (context, state) {
      final authState = ref.read(authControllerProvider);
      final location = state.matchedLocation;

      switch (authState.status) {
        case AuthStatus.unknown:
          return location == splashRoute ? null : splashRoute;
        case AuthStatus.unauthenticated:
          return location == loginRoute ? null : loginRoute;
        case AuthStatus.authenticated:
          final onAuthOnlyRoute = location == loginRoute || location == splashRoute;
          return onAuthOnlyRoute ? homeRoute : null;
      }
    },
    routes: [
      GoRoute(
        path: splashRoute,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: loginRoute,
        builder: (context, state) => const LoginScreen(),
      ),
      // Lightweight lookup screens reached via push (from the dashboard KPI
      // cards and the drawer's Workspace section) — they don't need their
      // own bottom-nav slot, so they sit outside the shell below.
      GoRoute(
        path: companiesRoute,
        builder: (context, state) => const CompaniesScreen(),
      ),
      GoRoute(
        path: branchesRoute,
        builder: (context, state) => const BranchesScreen(),
      ),
      GoRoute(
        path: settingsRoute,
        builder: (context, state) => const SettingsScreen(),
      ),
      // Five persistent bottom-nav sections, each with its own navigation
      // stack (so e.g. pushing a role detail from the Roles tab doesn't
      // disturb the Users tab's stack) sharing one Scaffold — the bottom
      // nav bar and drawer — via MainShell.
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => MainShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: homeRoute,
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: rolesRoute,
                builder: (context, state) => const RolesListScreen(),
                routes: [
                  // Nested under rolesRoute so both share this branch's stack;
                  // the literal 'new' path is registered before the ':id'
                  // pattern so it wins the match instead of being captured
                  // as `id: "new"`.
                  GoRoute(
                    path: 'new',
                    builder: (context, state) => const RoleFormScreen(),
                  ),
                  GoRoute(
                    path: ':id',
                    builder: (context, state) => RoleFormScreen(roleId: state.pathParameters['id']),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: usersRoute,
                builder: (context, state) => const UsersListScreen(),
                routes: [
                  GoRoute(
                    path: 'new',
                    builder: (context, state) => const UserNewPlaceholderScreen(),
                  ),
                  GoRoute(
                    path: ':id',
                    builder: (context, state) => UserDetailScreen(userId: state.pathParameters['id']!),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: reportsHubRoute,
                builder: (context, state) => const ReportsHubScreen(),
                routes: [
                  GoRoute(
                    path: 'general/:type',
                    builder: (context, state) {
                      final type = state.pathParameters['type']!;
                      return ReportDetailScreen(
                        family: ReportFamily.general,
                        type: type,
                        title: generalReportLabel(type),
                      );
                    },
                  ),
                  GoRoute(
                    path: 'financials/:type',
                    builder: (context, state) {
                      final type = state.pathParameters['type']!;
                      return ReportDetailScreen(
                        family: ReportFamily.financials,
                        type: type,
                        title: financialReportLabel(type),
                      );
                    },
                  ),
                  GoRoute(
                    path: 'hr/:category/:type',
                    builder: (context, state) {
                      final category = state.pathParameters['category']!;
                      final type = state.pathParameters['type']!;
                      return ReportDetailScreen(
                        family: ReportFamily.hr,
                        type: type,
                        category: category,
                        title: hrReportLabel(category, type),
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: auditRoute,
                builder: (context, state) => const AuditListScreen(),
                routes: [
                  GoRoute(
                    path: ':id',
                    builder: (context, state) => AuditDetailScreen(id: state.pathParameters['id']!),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
