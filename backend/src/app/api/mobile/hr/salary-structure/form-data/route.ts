import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { SalaryComponentsService } from '@/server/services/salary-components.service';

const EMPLOYMENT_TYPE_OPTIONS = [
  'PERMANENT',
  'PROBATION',
  'INTERNSHIP',
  'CONTRACTUAL',
  'WORKER',
  'STAFF',
  'MANAGEMENT',
];

// Picker data for the create/edit salary structure form: active salary
// components to attach, plus department/designation/employment-type/branch
// option lists — union of the HR master-data tables and whatever values are
// already in use on live employee records (mirrors the root page's logic so
// values entered before a master-data row existed still show up).
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'hr:read');
    const [salaryComponents, departmentRows, designationRows, employees, branches] = await Promise.all([
      SalaryComponentsService.getSalaryComponents(session, { status: 'ACTIVE' }),
      prisma.hrMasterData.findMany({
        where: { type: 'departments', status: 'ACTIVE' },
        select: { name: true, id: true },
        orderBy: [{ name: 'asc' }],
      }),
      prisma.hrMasterData.findMany({
        where: { type: 'designations', status: 'ACTIVE' },
        select: { name: true, id: true },
        orderBy: [{ name: 'asc' }],
      }),
      prisma.employee.findMany({
        where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
        select: { employmentType: true, department: true, designation: true },
      }),
      prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
      }),
    ]);

    const departments = Array.from(
      new Set([...departmentRows.map((row) => row.id), ...employees.map((row) => row.department).filter(Boolean) as string[]]),
    );
    const designations = Array.from(
      new Set([...designationRows.map((row) => row.id), ...employees.map((row) => row.designation).filter(Boolean) as string[]]),
    );
    const employmentTypes = Array.from(
      new Set([...EMPLOYMENT_TYPE_OPTIONS, ...employees.map((row) => row.employmentType).filter(Boolean) as string[]]),
    );

    return Response.json(apiOk({ salaryComponents, departments, designations, employmentTypes, branches }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/salary-structure/form-data failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 500 });
  }
}
