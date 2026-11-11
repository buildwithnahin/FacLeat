import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/server/db';
import { buildDesignationOptions } from '@/lib/hr-master-data';
import { DEFAULT_DEPARTMENTS, DEFAULT_EMPLOYMENT_TYPES, ERP_ROLE_NAMES } from '@/server/validators/hr';

/**
 * Shared option bundle for the employee create/edit forms. `excludeId` drops
 * the employee being edited from the reporting-manager list (an employee
 * can't report to themselves).
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const excludeId = req.nextUrl.searchParams.get('excludeId') ?? undefined;

  try {
    const [branches, masterRows, managers, roles, shifts] = await Promise.all([
      prisma.branch.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, code: true, name: true },
      }),
      prisma.hrMasterData.findMany({
        where: { type: { in: ['departments', 'designations'] }, status: 'ACTIVE' },
        orderBy: { name: 'asc' },
        select: { type: true, name: true, metadata: true },
      }),
      prisma.employee.findMany({
        where: { status: 'ACTIVE', id: excludeId ? { not: excludeId } : undefined },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, firstName: true, lastName: true, designation: true },
      }),
      prisma.role.findMany({
        where: { name: { in: [...ERP_ROLE_NAMES] } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.shift.findMany({
        where: { status: 'ACTIVE' },
        orderBy: [{ branch: { name: 'asc' } }, { name: 'asc' }],
        select: { id: true, name: true, code: true, branch: { select: { code: true, name: true } } },
      }),
    ]);

    const valuesFor = (type: string, fallback: readonly string[]) => {
      const values = masterRows.filter((row) => row.type === type).map((row) => row.name);
      return values.length ? values : [...fallback];
    };

    return Response.json(
      apiOk({
        branches,
        departments: valuesFor('departments', DEFAULT_DEPARTMENTS),
        designationOptions: buildDesignationOptions(
          masterRows.filter((row) => row.type === 'designations').map((row) => ({ name: row.name, metadata: row.metadata })),
        ),
        employmentTypes: [...DEFAULT_EMPLOYMENT_TYPES],
        shifts: shifts.map((shift) => ({
          id: shift.id,
          label: `${shift.code} · ${shift.name} · ${shift.branch.code}`,
        })),
        managers: managers.map((m) => ({
          id: m.id,
          label: `${m.code} · ${m.firstName} ${m.lastName}${m.designation ? ` · ${m.designation}` : ''}`,
        })),
        roles,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/employees/form-options failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
