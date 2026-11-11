import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/server/db';
import { hrService } from '@/server/services/hr.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);

  const from = sp.get('from') || defaultFrom;
  const to = sp.get('to') || defaultTo;
  const branchId = sp.get('branchId') || undefined;
  const department = sp.get('department') || undefined;
  const designation = sp.get('designation') || undefined;
  const shiftId = sp.get('shiftId') || undefined;
  const employeeId = sp.get('employeeId') || undefined;
  const status = sp.get('status') || undefined;
  const lateThreshold = sp.get('lateThreshold') ? Number(sp.get('lateThreshold')) : undefined;
  const earlyThreshold = sp.get('earlyThreshold') ? Number(sp.get('earlyThreshold')) : undefined;

  try {
    const [branches, shifts, employees, reportData] = await Promise.all([
      prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true } }),
      prisma.shift.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true } }),
      hrService.listEmployees(session, { status: 'ACTIVE' }),
      hrService.getLateEarlyReport(session, {
        from: new Date(from),
        to: new Date(to),
        branchId,
        department,
        designation,
        shiftId,
        employeeId,
        status,
        lateThreshold,
        earlyThreshold,
      }),
    ]);

    const departmentSet = new Set<string>();
    const designationSet = new Set<string>();
    for (const emp of employees) {
      if (emp.department) departmentSet.add(emp.department);
      if (emp.designation) designationSet.add(emp.designation);
    }

    return Response.json(
      apiOk({
        filters: { from, to, branchId: branchId ?? '', department: department ?? '', designation: designation ?? '', shiftId: shiftId ?? '', employeeId: employeeId ?? '', status: status ?? '', lateThreshold: lateThreshold ?? '', earlyThreshold: earlyThreshold ?? '' },
        branches: branches.map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` })),
        departments: Array.from(departmentSet).sort().map((d) => ({ value: d, label: d })),
        designations: Array.from(designationSet).sort().map((d) => ({ value: d, label: d })),
        shifts: shifts.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` })),
        employees: employees.map((e) => ({ value: e.id, label: `${e.code} · ${e.firstName} ${e.lastName}` })),
        // reportData is already a plain-JSON-safe DTO from hrService.getLateEarlyReport
        // (rows / summary / monthlyStats) — pass through as-is.
        report: reportData,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/late-early-report failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
