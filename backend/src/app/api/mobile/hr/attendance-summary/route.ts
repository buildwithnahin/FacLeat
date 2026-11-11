import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/server/db';
import { attendanceSummaryService } from '@/server/services/attendance-summary.service';
import { hrService } from '@/server/services/hr.service';
import { attendanceSummaryGenerateSchema } from '@/server/validators/attendance-summary';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const activeBranch = session.activeBranchId ?? undefined;
  const now = new Date();
  const currentMonthStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const summaryMonth = sp.get('summaryMonth') || currentMonthStr;
  const branchId = sp.get('branchId') || activeBranch;

  try {
    const [branches, shifts, employees] = await Promise.all([
      prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true } }),
      prisma.shift.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true } }),
      hrService.listEmployees(session, { status: 'ACTIVE' }),
    ]);

    const records =
      branchId && summaryMonth ? await attendanceSummaryService.list(session, { branchId, summaryMonth }) : [];

    const deptSet = new Set<string>();
    for (const e of employees) if (e.department) deptSet.add(e.department);

    return Response.json(
      apiOk({
        summaryMonth,
        branches: branches.map((b) => ({ id: b.id, label: `${b.code} · ${b.name}` })),
        departments: Array.from(deptSet).sort().map((d) => ({ id: d, label: d })),
        shifts: shifts.map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` })),
        employees: employees.map((e) => ({ id: e.id, label: `${e.code} · ${e.firstName} ${e.lastName}` })),
        rows: records.map((r) => ({
          id: r.id,
          branchId: r.branchId,
          employeeId: r.employeeId,
          employeeCode: r.employee.code,
          employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
          department: r.employee.department ?? '-',
          designation: r.employee.designation ?? '-',
          summaryMonth: r.summaryMonth,
          totalCalendarDays: r.totalCalendarDays,
          weeklyOffDays: r.weeklyOffDays,
          holidayDays: r.holidayDays,
          workingDays: r.workingDays,
          presentDays: r.presentDays,
          absentDays: r.absentDays,
          leaveDays: r.leaveDays,
          lateDays: r.lateDays,
          earlyExitDays: r.earlyExitDays,
          totalWorkedHours: Number(r.totalWorkedHours).toFixed(1),
          totalOtHours: Number(r.totalOtHours).toFixed(1),
          payableDays: Number(r.payableDays).toFixed(1),
          status: r.status,
          isLocked: r.isLocked,
          sentToPayroll: r.sentToPayroll,
        })),
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/attendance-summary failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = attendanceSummaryGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const result = await attendanceSummaryService.generateOrRecalculate(session, parsed.data);
    return Response.json(apiOk(result));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/attendance-summary failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
