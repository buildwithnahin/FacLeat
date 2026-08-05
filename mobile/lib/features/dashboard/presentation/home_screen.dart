import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/router/app_router.dart';
import '../../../core/router/main_shell.dart';
import '../../../core/theme/app_colors.dart';
import '../../audit/domain/audit_entry.dart';
import '../../auth/application/auth_controller.dart';
import '../../notifications/presentation/widgets/notification_bell.dart';
import '../../reports/application/report_provider.dart';
import '../application/dashboard_provider.dart';
import '../application/me_provider.dart';
import 'widgets/kpi_card.dart';

/// The Super-Admin "Command Center" — a richer overview than a plain KPI
/// grid: system health, KPIs, a branch-network strip, and a live recent-
/// activity feed. Primary navigation (Roles/Users/Reports/Audit) lives in
/// the bottom nav bar now, not on this screen.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final meAsync = ref.watch(meProvider);
    final dashboardAsync = ref.watch(dashboardProvider);

    final displayName = meAsync.valueOrNull?.name ?? authState.user?.name ?? 'Admin';
    final greeting = _greetingFor(DateTime.now().hour);

    return Scaffold(
      appBar: AppBar(
        leading: const DrawerMenuButton(),
        title: const Text('Command Center'),
        actions: [
          NotificationBell(onTap: () => context.push(notificationsRoute)),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(dashboardProvider);
          ref.invalidate(branchesProvider);
          ref.invalidate(recentActivityProvider);
          await ref.read(dashboardProvider.future);
        },
        child: ListView(
          key: const Key('homeScreenList'),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            _GreetingHeader(greeting: greeting, name: displayName),
            const SizedBox(height: 18),
            dashboardAsync.when(
              data: (summary) => _DashboardContent(summary: summary),
              loading: () => const _DashboardLoading(),
              error: (error, stackTrace) => _DashboardError(
                onRetry: () => ref.invalidate(dashboardProvider),
              ),
            ),
            const SizedBox(height: 28),
            const _SectionLabel(label: 'Branch network', icon: Icons.store_mall_directory_outlined),
            const SizedBox(height: 10),
            const _BranchesStrip(),
            const SizedBox(height: 28),
            const _SectionLabel(label: 'Recent activity', icon: Icons.bolt_outlined),
            const SizedBox(height: 10),
            const _RecentActivityCard(),
          ],
        ),
      ),
    );
  }

  static String _greetingFor(int hour) {
    if (hour < 5) return 'Working late,';
    if (hour < 12) return 'Good morning,';
    if (hour < 17) return 'Good afternoon,';
    if (hour < 21) return 'Good evening,';
    return 'Working late,';
  }
}

class _GreetingHeader extends StatelessWidget {
  const _GreetingHeader({required this.greeting, required this.name});

  final String greeting;
  final String name;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final firstName = name.trim().split(RegExp(r'\s+')).first;
    final initials = name.trim().isEmpty
        ? '?'
        : name.trim().split(RegExp(r'\s+')).take(2).map((w) => w[0].toUpperCase()).join();

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.primary.withValues(alpha: 0.16),
            AppColors.primary.withValues(alpha: 0.04),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.18)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  greeting,
                  style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                ),
                Text(
                  firstName,
                  style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  'Here is what is happening across your business today.',
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
          CircleAvatar(
            radius: 26,
            backgroundColor: AppColors.primary.withValues(alpha: 0.18),
            child: Text(
              initials,
              style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 18),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 350.ms).slideY(begin: -0.08, end: 0, duration: 350.ms, curve: Curves.easeOutCubic);
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

class _DashboardContent extends StatelessWidget {
  const _DashboardContent({required this.summary});

  final DashboardSummary summary;

  @override
  Widget build(BuildContext context) {
    final grouped = NumberFormat.decimalPattern();
    String money(int value) => grouped.format(value);

    final businessCards = <_KpiSpec>[
      _KpiSpec(
        'Total sales',
        summary.totalSales.round(),
        Icons.point_of_sale_outlined,
        AppColors.success,
        (ctx) => ctx.go(reportsGeneralPath('sales-summary')),
        valueFormatter: money,
      ),
      _KpiSpec(
        'Total purchases',
        summary.totalPurchases.round(),
        Icons.shopping_cart_outlined,
        AppColors.primary,
        (ctx) => ctx.go(reportsGeneralPath('purchase-summary')),
        valueFormatter: money,
      ),
      _KpiSpec(
        // Labelled "(gross)" because the backend currently derives this from
        // gross sales, not a real net-of-COGS income-statement figure — see
        // the comment on `revenue` in src/app/api/mobile/dashboard/route.ts.
        // Without this qualifier the card is indistinguishable from "Total
        // sales" and reads as a rendering bug rather than a known backend
        // simplification. A real net revenue figure needs accountsService's
        // income statement wired in, which is out of scope for this fix.
        'Revenue (gross)',
        summary.revenue.round(),
        Icons.trending_up_outlined,
        AppColors.success,
        (ctx) => ctx.go(reportsFinancialsPath('income-statement')),
        valueFormatter: money,
      ),
      _KpiSpec(
        'Pending orders',
        summary.pendingOrders,
        Icons.local_shipping_outlined,
        AppColors.warning,
        (ctx) => ctx.go(reportsGeneralPath('purchase-summary')),
      ),
      _KpiSpec(
        'Pending approvals',
        summary.pendingApprovals,
        Icons.pending_actions_outlined,
        AppColors.warning,
        (ctx) => ctx.go(approvalsRoute),
      ),
      _KpiSpec(
        'Low stock items',
        summary.lowStockProducts,
        Icons.warning_amber_outlined,
        AppColors.danger,
        (ctx) => ctx.go(reportsGeneralPath('inventory-valuation')),
      ),
      summary.employeeAttendance == null
          ? _KpiSpec(
              'Employee attendance',
              0,
              Icons.badge_outlined,
              AppColors.primary,
              (ctx) => ctx.go(reportsHrPath('attendance', 'ATTENDANCE_SUMMARY')),
              // Zero active employees to measure is a distinct "no data"
              // case, not a genuine 0% attendance rate — render a static
              // dash/label instead of a number so it can't be misread as
              // "everyone is absent". See DashboardSummary.employeeAttendance
              // doc comment for the backend's null-when-no-denominator
              // contract this mirrors.
              customBuilder: (ctx) => _NoDataKpiCard(
                label: 'Employee attendance',
                icon: Icons.badge_outlined,
                color: AppColors.primary,
                onTap: () => ctx.go(reportsHrPath('attendance', 'ATTENDANCE_SUMMARY')),
              ),
            )
          : _KpiSpec(
              'Employee attendance',
              summary.employeeAttendance!.round(),
              Icons.badge_outlined,
              AppColors.primary,
              (ctx) => ctx.go(reportsHrPath('attendance', 'ATTENDANCE_SUMMARY')),
              suffix: '%',
            ),
      _KpiSpec(
        'Outstanding payments',
        summary.outstandingPayments.round(),
        Icons.account_balance_wallet_outlined,
        AppColors.danger,
        (ctx) => ctx.go(reportsFinancialsPath('balance-sheet')),
        valueFormatter: money,
      ),
    ];

    final systemCards = <_KpiSpec>[
      _KpiSpec(
        'Companies',
        summary.totalCompanies,
        Icons.apartment_outlined,
        AppColors.primary,
        (ctx) => ctx.push(companiesRoute),
      ),
      _KpiSpec(
        'Branches',
        summary.totalBranches,
        Icons.store_mall_directory_outlined,
        AppColors.primary,
        (ctx) => ctx.go(branchMonitoringRoute),
      ),
      _KpiSpec(
        'Users',
        summary.totalUsers,
        Icons.people_alt_outlined,
        AppColors.primary,
        (ctx) => ctx.go(usersRoute),
      ),
      _KpiSpec(
        'Active modules',
        summary.activeModules,
        Icons.dashboard_customize_outlined,
        AppColors.primary,
        (ctx) => ctx.push(rolesRoute),
      ),
      _KpiSpec(
        "Today's logins",
        summary.todayLoginUsers,
        Icons.login_outlined,
        AppColors.success,
        (ctx) => ctx.push(auditRoute),
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SystemHealthBanner(health: summary.systemHealth),
        const SizedBox(height: 16),
        _KpiGrid(key: const Key('kpiGrid'), cards: businessCards),
        const SizedBox(height: 24),
        const _SectionLabel(label: 'System', icon: Icons.settings_outlined),
        const SizedBox(height: 10),
        _KpiGrid(key: const Key('systemKpiGrid'), cards: systemCards, delayOffset: businessCards.length * 60),
      ],
    );
  }
}

class _KpiGrid extends StatelessWidget {
  const _KpiGrid({super.key, required this.cards, this.delayOffset = 0});

  final List<_KpiSpec> cards;
  final int delayOffset;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: cards.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.45,
      ),
      itemBuilder: (context, index) {
        final spec = cards[index];
        final card = spec.customBuilder != null
            ? spec.customBuilder!(context)
            : KpiCard(
                label: spec.label,
                value: spec.value,
                icon: spec.icon,
                color: spec.color,
                suffix: spec.suffix,
                valueFormatter: spec.valueFormatter,
                onTap: () => spec.onTap(context),
              );
        return card.animate().fadeIn(delay: (delayOffset + index * 60).ms, duration: 400.ms).slideY(
              begin: 0.15,
              end: 0,
              duration: 400.ms,
              curve: Curves.easeOutCubic,
            );
      },
    );
  }
}

class _KpiSpec {
  const _KpiSpec(
    this.label,
    this.value,
    this.icon,
    this.color,
    this.onTap, {
    this.suffix = '',
    this.valueFormatter,
    this.customBuilder,
  });

  final String label;
  final int value;
  final IconData icon;
  final Color color;
  final String suffix;
  final String Function(int value)? valueFormatter;
  final void Function(BuildContext context) onTap;

  /// When set, fully replaces the normal `KpiCard` count-up rendering for
  /// this slot — used for "no data" states a plain int `value` can't
  /// represent (e.g. a null percentage that must not look like a genuine
  /// 0%). `value`/`suffix`/`valueFormatter` are ignored when this is set.
  final Widget Function(BuildContext context)? customBuilder;
}

/// Visual sibling of [KpiCard] for a metric that has no numeric value to
/// show yet (as opposed to a real `0`) — same icon box / label / padding /
/// border conventions, but a static "No data yet" line instead of a
/// count-up tween, so it can never be mistaken for an actual zero reading.
class _NoDataKpiCard extends StatelessWidget {
  const _NoDataKpiCard({
    required this.label,
    required this.icon,
    required this.color,
    this.onTap,
  });

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: theme.cardTheme.color ?? theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        key: Key('kpiCardTap_$label'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withValues(alpha: 0.16)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, size: 19, color: color),
                  ),
                  const Spacer(),
                  if (onTap != null)
                    Icon(Icons.chevron_right, size: 18, color: theme.colorScheme.onSurfaceVariant),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                'No data yet',
                key: Key('kpiValue_$label'),
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SystemHealthBanner extends StatelessWidget {
  const _SystemHealthBanner({required this.health});

  final String health;

  Color _colorFor(String health) {
    switch (health.toLowerCase()) {
      case 'healthy':
      case 'ok':
      case 'good':
        return AppColors.success;
      case 'degraded':
      case 'warning':
        return AppColors.warning;
      case 'down':
      case 'critical':
      case 'unhealthy':
        return AppColors.danger;
      default:
        return AppColors.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = _colorFor(health);

    return Container(
      key: const Key('systemHealthBanner'),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ).animate(onPlay: (controller) => controller.repeat(reverse: true)).fadeIn(
                duration: 900.ms,
              ).then().fadeOut(duration: 900.ms),
          const SizedBox(width: 10),
          Text(
            'System status: ',
            style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
          Text(
            health,
            key: const Key('systemHealthLabel'),
            style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700, color: color),
          ),
        ],
      ),
    );
  }
}

class _DashboardLoading extends StatelessWidget {
  const _DashboardLoading();

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: 6,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.45,
      ),
      itemBuilder: (context, index) => Container(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(16),
        ),
      ).animate(onPlay: (c) => c.repeat(reverse: true)).fadeIn(duration: 700.ms).then().fadeOut(duration: 700.ms),
    );
  }
}

class _DashboardError extends StatelessWidget {
  const _DashboardError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.danger.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.error_outline, color: AppColors.danger),
              const SizedBox(width: 8),
              Text(
                'Could not load dashboard data',
                style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

/// Horizontally-scrolling strip of every branch in the network — real data
/// from `GET /branches`, reusing [branchesProvider] already built for the
/// report filter bar.
class _BranchesStrip extends ConsumerWidget {
  const _BranchesStrip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branchesAsync = ref.watch(branchesProvider);
    final theme = Theme.of(context);

    return SizedBox(
      key: const Key('branchesStrip'),
      height: 98,
      child: branchesAsync.when(
        loading: () => ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: 3,
          separatorBuilder: (_, _) => const SizedBox(width: 10),
          itemBuilder: (context, index) => Container(
            width: 140,
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(16),
            ),
          ).animate(onPlay: (c) => c.repeat(reverse: true)).fadeIn(duration: 700.ms).then().fadeOut(duration: 700.ms),
        ),
        error: (_, _) => Center(
          child: Text('Could not load branches', style: theme.textTheme.bodySmall),
        ),
        data: (branches) {
          if (branches.isEmpty) {
            return Center(child: Text('No branches yet', style: theme.textTheme.bodySmall));
          }
          return ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: branches.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, index) {
              final branch = branches[index];
              return Container(
                width: 148,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.cardTheme.color ?? theme.colorScheme.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.store_mall_directory_outlined, size: 16, color: AppColors.primary),
                    ),
                    const Spacer(),
                    Text(
                      branch.name,
                      style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      branch.code,
                      style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ).animate().fadeIn(delay: (index * 60).ms, duration: 300.ms).slideX(begin: 0.1, end: 0, duration: 300.ms);
            },
          );
        },
      ),
    );
  }
}

/// Live feed of the 5 most recent audit-log entries — real data, gives the
/// dashboard an at-a-glance "what just happened" widget without duplicating
/// the full Audit Log screen's pagination state.
class _RecentActivityCard extends ConsumerWidget {
  const _RecentActivityCard();

  Color _actionColor(String action) {
    final upper = action.toUpperCase();
    if (upper.contains('DELETE') || upper.contains('FAIL') || upper.contains('REJECT')) {
      return AppColors.danger;
    }
    if (upper.contains('UPDATE') || upper.contains('PENDING')) return AppColors.warning;
    return AppColors.success;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final activityAsync = ref.watch(recentActivityProvider);

    return Container(
      key: const Key('recentActivityCard'),
      decoration: BoxDecoration(
        color: theme.cardTheme.color ?? theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
      ),
      child: activityAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)),
        ),
        error: (_, _) => Padding(
          padding: const EdgeInsets.all(20),
          child: Text('Could not load recent activity', style: theme.textTheme.bodySmall),
        ),
        data: (entries) {
          if (entries.isEmpty) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: Text('No activity yet', style: theme.textTheme.bodySmall),
            );
          }
          return Column(
            children: [
              for (var i = 0; i < entries.length; i++) ...[
                if (i > 0) const Divider(height: 1),
                _ActivityRow(entry: entries[i], color: _actionColor(entries[i].action), index: i),
              ],
              Padding(
                padding: const EdgeInsets.all(10),
                child: TextButton.icon(
                  onPressed: () => context.push(auditRoute),
                  icon: const Icon(Icons.history, size: 16),
                  label: const Text('View full audit log'),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.entry, required this.color, required this.index});

  final AuditEntry entry;
  final Color color;
  final int index;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ts = entry.createdAt;
    final timeLabel =
        '${ts.hour.toString().padLeft(2, '0')}:${ts.minute.toString().padLeft(2, '0')} · '
        '${ts.year}-${ts.month.toString().padLeft(2, '0')}-${ts.day.toString().padLeft(2, '0')}';

    return ListTile(
      dense: true,
      leading: CircleAvatar(
        radius: 16,
        backgroundColor: color.withValues(alpha: 0.12),
        child: Icon(Icons.bolt, size: 15, color: color),
      ),
      title: Text(
        '${entry.actor?.name ?? 'System'} · ${entry.action}',
        style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text(
        '${entry.module} · $timeLabel',
        style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
      ),
    ).animate().fadeIn(delay: (index * 50).ms, duration: 250.ms);
  }
}
