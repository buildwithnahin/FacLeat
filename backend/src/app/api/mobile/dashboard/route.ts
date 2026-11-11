import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { MODULES } from '@/constants/navigation';
import { reportsService } from '@/server/services/reports.service';

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

/**
 * Superadmin overview for the Flutter "Reports Hub" — mirrors
 * loadSuperAdminData() in src/app/(app)/dashboard/role-dashboard.tsx, merged
 * with the pending-approvals / low-stock fields from reportsService.dashboardKpis.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'dashboard:read');

    const today = startOfDay();
    const [companies, branches, users, todayLogins, kpis, pendingOrders, presentToday, activeEmployees] =
      await Promise.all([
        prisma.company.count({ where: { isActive: true } }),
        prisma.branch.count(),
        prisma.user.count(),
        prisma.auditLog.findMany({
          where: {
            module: 'auth',
            action: 'LOGIN_SUCCESS',
            actorId: { not: null },
            createdAt: { gte: today },
          },
          select: { actorId: true },
          distinct: ['actorId'],
        }),
        reportsService.dashboardKpis(session, {}),
        prisma.purchaseOrder.count({ where: { status: 'PENDING' } }),
        // Mirrors loadHrData()'s presentToday query in role-dashboard.tsx —
        // AttendanceRecord.date is a @db.Date column, so it lines up exactly
        // with startOfDay().
        prisma.attendanceRecord.count({
          where: { date: today, status: { in: ['PRESENT', 'LATE', 'HALF_DAY'] } },
        }),
        prisma.employee.count({ where: { status: 'ACTIVE' } }),
      ]);

    const data = {
      totalCompanies: companies,
      totalBranches: branches,
      totalUsers: users,
      activeModules: MODULES.length,
      systemHealth: branches > 0 && users > 0 ? 'Healthy' : 'Check',
      todayLoginUsers: todayLogins.length,
      pendingApprovals: kpis.pendingApprovals,
      lowStockProducts: kpis.lowStockProducts,
      activeProducts: kpis.activeProducts,
      totalSales: kpis.salesGross.toNumber(),
      totalPurchases: kpis.purchaseTotal.toNumber(),
      // Gross sales stands in for "revenue" here — this is not a net-of-COGS
      // accounting revenue figure, which would need accountsService's income
      // statement and is out of scope for this pass.
      revenue: kpis.salesGross.toNumber(),
      outstandingPayments: kpis.salesOutstanding.toNumber() + kpis.purchaseOutstanding.toNumber(),
      pendingOrders,
      employeeAttendance:
        activeEmployees > 0 ? Math.round((presentToday / activeEmployees) * 1000) / 10 : null,
    };

    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/dashboard failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
