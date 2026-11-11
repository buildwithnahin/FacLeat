import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import {
  resolveDashboardRole,
  shouldUseBranchScope,
  loadDashboardData,
  getDashboardPendingTasks,
  getDashboardNotifications,
  getDashboardApprovals,
  type DashboardRole,
} from '@/server/services/dashboard-summary.service';

const ROLE_MODULES: Record<DashboardRole, string[]> = {
  'super-admin': ['users', 'roles', 'branches', 'audit', 'notifications', 'documents', 'approvals'],
  admin: ['users', 'roles', 'branches', 'approvals', 'audit', 'notifications'],
  hr: ['hr', 'notifications', 'approvals'],
  accounts: ['accounts', 'coa', 'purchase', 'reports'],
  commercial: ['trade', 'documents', 'approvals'],
  inventory: ['inventory', 'warehouse', 'barcode', 'reports'],
  production: ['factory', 'inventory', 'warehouse'],
  purchase: ['purchase', 'suppliers', 'warehouse', 'approvals'],
  store: ['warehouse', 'inventory', 'purchase'],
  sales: ['crm', 'pos', 'wholesale', 'corporate-sales', 'ecommerce'],
  management: ['reports', 'accounts', 'purchase', 'factory', 'inventory', 'approvals'],
};

/**
 * Web dashboard summary — mirrors what role-dashboard.tsx / accounts-dashboard.tsx
 * used to compute via direct Prisma calls before the backend/web split. Returns
 * everything a role's dashboard page needs in one round trip: role-specific KPI
 * metrics, cross-module pending-task counts, unread notifications, and the
 * pending-approvals queue scoped to that role's modules.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const role = resolveDashboardRole(session);
    const branchId = shouldUseBranchScope(role) ? (session.activeBranchId ?? undefined) : undefined;

    const [dashboard, pendingTasks, notifications, approvals] = await Promise.all([
      loadDashboardData(role, session, branchId),
      getDashboardPendingTasks(session),
      getDashboardNotifications(session),
      getDashboardApprovals(ROLE_MODULES[role], branchId),
    ]);

    return Response.json(
      apiOk({
        role,
        metrics: dashboard.metrics,
        notes: dashboard.notes,
        pendingTasks,
        notifications,
        approvals: approvals.map((a) => ({
          id: a.id,
          title: a.title,
          module: a.module,
          action: a.action,
          amount: a.amount ? a.amount.toString() : null,
          currency: a.currency,
          status: a.status,
        })),
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/dashboard/role failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
