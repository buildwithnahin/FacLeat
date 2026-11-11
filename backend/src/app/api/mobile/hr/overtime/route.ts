import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/server/db';
import { hrService } from '@/server/services/hr.service';
import { overtimeService } from '@/server/services/overtime.service';
import { overtimeGenerateSchema } from '@/server/validators/overtime';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const activeBranch = session.activeBranchId ?? undefined;
  const today = new Date().toISOString().slice(0, 10);

  try {
    const [branches, shifts, employees, records] = await Promise.all([
      prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true } }),
      prisma.shift.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true } }),
      hrService.listEmployees(session, { status: 'ACTIVE' }),
      overtimeService.list(session, {
        branchId: sp.get('branchId') || activeBranch,
        status: sp.get('status') || undefined,
        otMonth: sp.get('otMonth') || undefined,
        employeeId: sp.get('employeeId') || undefined,
        q: sp.get('q') || undefined,
      }),
    ]);

    const deptSet = new Set<string>();
    for (const e of employees) if (e.department) deptSet.add(e.department);

    const rows = records.map((r) => ({
      id: r.id,
      otNumber: r.otNumber,
      employeeCode: r.employee.code,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      department: r.employee.department ?? '-',
      designation: r.employee.designation ?? '-',
      date: r.otDate.toISOString().slice(0, 10),
      shiftName: r.shift?.name ?? '-',
      shiftStart: r.shift?.startTime ?? '-',
      shiftEnd: r.shift?.endTime ?? '-',
      checkIn: r.checkIn ? r.checkIn.toISOString().slice(11, 16) : '-',
      checkOut: r.checkOut ? r.checkOut.toISOString().slice(11, 16) : '-',
      extraHours: `${(r.extraWorkedMinutes / 60).toFixed(1)}h`,
      approvedHours: `${(r.approvedOtMinutes / 60).toFixed(1)}h`,
      otAmount: Number(r.otAmount).toFixed(2),
      managerStatus: r.managerStatus ?? '-',
      hrStatus: r.hrStatus ?? '-',
      accountsStatus: r.accountsStatus ?? '-',
      status: r.status,
      source: r.source,
      otType: r.otType,
      totalWorkedMinutes: r.totalWorkedMinutes,
      regularDutyMinutes: r.regularDutyMinutes,
      breakMinutes: r.breakMinutes,
      extraWorkedMinutes: r.extraWorkedMinutes,
      lateMinutes: r.lateMinutes,
      earlyExitMinutes: r.earlyExitMinutes,
      eligibleOtMinutes: r.eligibleOtMinutes,
      approvedOtMinutes: r.approvedOtMinutes,
      otRateType: r.otRateType,
      otRatePerHour: Number(r.otRatePerHour).toFixed(2),
      managerRemarks: r.managerRemarks ?? '',
      hrRemarks: r.hrRemarks ?? '',
      accountsRemarks: r.accountsRemarks ?? '',
      remarks: r.remarks ?? '',
    }));

    return Response.json(
      apiOk({
        defaultDate: today,
        branches: branches.map((b) => ({ id: b.id, label: `${b.code} · ${b.name}` })),
        departments: Array.from(deptSet).sort().map((d) => ({ id: d, label: d })),
        shifts: shifts.map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` })),
        employees: employees.map((e) => ({ id: e.id, label: `${e.code} · ${e.firstName} ${e.lastName}` })),
        rows,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/overtime failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = overtimeGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const result = await overtimeService.generateFromAttendance(session, parsed.data);
    return Response.json(apiOk(result));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/overtime failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
