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
import '../../features/approvals/presentation/approval_detail_screen.dart';
import '../../features/approvals/presentation/approvals_list_screen.dart';
import '../../features/audit/presentation/audit_detail_screen.dart';
import '../../features/audit/presentation/audit_list_screen.dart';
import '../../features/notifications/presentation/notification_center_screen.dart';
import '../../features/reports/application/report_provider.dart';
import '../../features/reports/data/report_catalog.dart';
import '../../features/reports/presentation/report_detail_screen.dart';
import '../../features/reports/presentation/reports_hub_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../../features/workspace/presentation/companies_screen.dart';
import '../../features/search/presentation/global_search_screen.dart';
import '../../features/branch_monitoring/presentation/branch_monitoring_screen.dart';
import '../../features/announcements/presentation/announcements_list_screen.dart';
import '../../features/announcements/presentation/announcement_detail_screen.dart';
import '../../features/announcements/presentation/announcement_compose_screen.dart';
import '../../features/app_lock/application/app_lock_controller.dart';
import '../../features/app_lock/domain/app_lock_status.dart';
import '../../features/app_lock/presentation/app_lock_screen.dart';
import '../../features/settings/presentation/change_password_screen.dart';
import 'main_shell.dart';

const String splashRoute = '/splash';
const String loginRoute = '/login';
const String homeRoute = '/home';
const String approvalsRoute = '/approvals';
const String approvalDetailRoute = '/approvals/:id';
const String usersRoute = '/users';
const String userNewRoute = '/users/new';
const String userDetailRoute = '/users/:id';
const String reportsHubRoute = '/reports';
const String reportsGeneralRoute = '/reports/general/:type';
const String reportsFinancialsRoute = '/reports/financials/:type';
const String reportsHrRoute = '/reports/hr/:category/:type';
const String branchMonitoringRoute = '/branch-monitoring';
// Secondary screens reached from the drawer — none of these carry enough
// standalone traffic to earn a bottom-nav slot, so they're pushed on top of
// whichever tab the drawer was opened from rather than being shell branches.
const String rolesRoute = '/roles';
const String roleNewRoute = '/roles/new';
const String roleDetailRoute = '/roles/:id';
const String auditRoute = '/audit';
const String auditDetailRoute = '/audit/:id';
const String companiesRoute = '/companies';
const String settingsRoute = '/settings';
const String changePasswordRoute = '/settings/change-password';
const String lockRoute = '/lock';
const String notificationsRoute = '/notifications';
const String searchRoute = '/search';
const String announcementsRoute = '/announcements';
const String announcementDetailRoute = '/announcements/:id';

String roleDetailPath(String id) => '/roles/$id';
String userDetailPath(String id) => '/users/$id';
String reportsGeneralPath(String type) => '/reports/general/$type';
String reportsFinancialsPath(String type) => '/reports/financials/$type';
String reportsHrPath(String category, String type) => '/reports/hr/$category/$type';
String auditDetailPath(String id) => '/audit/$id';
String approvalDetailPath(String id) => '/approvals/$id';

/// Bridges Riverpod's [authControllerProvider]/[appLockControllerProvider]
/// to go_router's [Listenable]-based `refreshListenable`, so the router
/// re-evaluates [GoRouter.redirect] whenever either status changes.
class _RouterRefreshNotifier extends ChangeNotifier {
  _RouterRefreshNotifier(Ref ref) {
    ref.listen<AuthState>(authControllerProvider, (previous, next) {
      if (previous?.status != next.status) {
        notifyListeners();
      }
    });
    ref.listen<AppLockState>(appLockControllerProvider, (previous, next) {
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
          if (onAuthOnlyRoute) return homeRoute;

          final isLocked = ref.read(appLockControllerProvider).status == AppLockStatus.locked;
          if (isLocked) return location == lockRoute ? null : lockRoute;
          if (location == lockRoute) return homeRoute;
          return null;
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
      GoRoute(
        path: lockRoute,
        builder: (context, state) => const AppLockScreen(),
      ),
      // Lightweight lookup / drawer-only screens reached via push — none of
      // these need their own bottom-nav slot, so they sit outside the shell.
      GoRoute(
        path: companiesRoute,
        builder: (context, state) => const CompaniesScreen(),
      ),
      GoRoute(
        path: settingsRoute,
        builder: (context, state) => const SettingsScreen(),
        routes: [
          GoRoute(
            path: 'change-password',
            builder: (context, state) => const ChangePasswordScreen(),
          ),
        ],
      ),
      GoRoute(
        path: rolesRoute,
        builder: (context, state) => const RolesListScreen(),
        routes: [
          // Literal 'new' registered before ':id' so it wins the match
          // instead of being captured as `id: "new"`.
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
      GoRoute(
        path: notificationsRoute,
        builder: (context, state) => const NotificationCenterScreen(),
      ),
      GoRoute(
        path: searchRoute,
        builder: (context, state) => const GlobalSearchScreen(),
      ),
      GoRoute(
        path: announcementsRoute,
        builder: (context, state) => const AnnouncementsListScreen(),
        routes: [
          // Literal 'new' registered before ':id' so it wins the match,
          // same ordering rule as roles/users routes above.
          GoRoute(
            path: 'new',
            builder: (context, state) => const AnnouncementComposeScreen(),
          ),
          GoRoute(
            path: ':id',
            builder: (context, state) => AnnouncementDetailScreen(id: state.pathParameters['id']!),
          ),
        ],
      ),
      // Five persistent bottom-nav sections — Home, Approvals, Users,
      // Reports, Multi-Branch Monitoring — each with its own navigation
      // stack (so e.g. pushing a user detail from the Users tab doesn't
      // disturb the Reports tab's stack) sharing one Scaffold — the bottom
      // nav bar and drawer — via MainShell. Order here must match
      // MainShell's NavigationDestination order exactly (index-mapped).
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
                path: approvalsRoute,
                builder: (context, state) => const ApprovalsListScreen(),
                routes: [
                  GoRoute(
                    path: ':id',
                    builder: (context, state) => ApprovalDetailScreen(id: state.pathParameters['id']!),
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
                path: branchMonitoringRoute,
                builder: (context, state) => const BranchMonitoringScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
