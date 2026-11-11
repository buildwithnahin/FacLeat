import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { hrService } from '@/server/services/hr.service';
import { prisma } from '@/server/db';

/**
 * Compact DTO for the HR module landing page. Computed server-side (rather
 * than shipping full employee/attendance/leave arrays) so the web page does
 * no cross-record aggregation of its own — mirrors the role-dashboard
 * pattern in dashboard-summary.service.ts. Leave and payroll figures are
 * read-only here (hrService.listLeaves / listPayrollRuns); the Leave and
 * Payroll HR sub-areas own the write paths and their own detail pages.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const today = new Date();
    const day = new Date(today.toISOString().slice(0, 10));

    const [employees, attendance, leaves, payrollRuns, recentAudit] = await Promise.all([
      hrService.listEmployees(session),
      hrService.listAttendance(session, { from: day, to: day }),
      hrService.listLeaves(session),
      hrService.listPayrollRuns(session),
      prisma.auditLog.findMany({
        where: { module: 'hr' },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    ]);

    const activeEmployees = employees.filter((e) => e.status === 'ACTIVE');
    const presentToday = attendance.filter((r) => ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.status)).length;
    const absentToday = attendance.filter((r) => r.status === 'ABSENT').length;
    const lateToday = attendance.filter((r) => r.status === 'LATE').length;
    const onLeaveToday = leaves.filter(
      (l) => l.status === 'APPROVED' && l.fromDate.getTime() <= day.getTime() && l.toDate.getTime() >= day.getTime(),
    ).length;
    const pendingLeave = leaves.filter((l) => ['PENDING_MANAGER', 'PENDING_HR'].includes(l.status)).length;
    const newJoining = employees.filter(
      (e) => e.joinedAt.getFullYear() === today.getFullYear() && e.joinedAt.getMonth() === today.getMonth(),
    ).length;
    const pendingPayroll = payrollRuns.filter((r) => ['DRAFT', 'APPROVED'].includes(r.status)).length;
    const latestPayroll = payrollRuns[0];

    return Response.json(
      apiOk({
        totalEmployees: employees.length,
        activeEmployees: activeEmployees.length,
        attendanceMarkedToday: attendance.length,
        presentToday,
        absentToday,
        lateToday,
        onLeaveToday,
        pendingLeave,
        newJoining,
        pendingPayroll,
        latestPayroll: latestPayroll
          ? { period: latestPayroll.period, status: latestPayroll.status, totalNet: latestPayroll.totalNet.toString() }
          : null,
        recentAudit: recentAudit.map((a) => ({
          id: a.id,
          action: a.action,
          entityType: a.entityType,
          module: a.module,
          createdAt: a.createdAt.toISOString(),
        })),
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/dashboard failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
