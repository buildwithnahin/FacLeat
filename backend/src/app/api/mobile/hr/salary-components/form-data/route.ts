import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';

const EMPLOYMENT_TYPE_OPTIONS = [
  'PERMANENT',
  'PROBATION',
  'INTERNSHIP',
  'CONTRACTUAL',
  'WORKER',
  'STAFF',
  'MANAGEMENT',
];

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'hr:read');
    const [departmentRows, designationRows, employees] = await Promise.all([
      prisma.hrMasterData.findMany({
        where: { type: 'departments', status: 'ACTIVE' },
        select: { name: true },
        orderBy: [{ name: 'asc' }],
      }),
      prisma.hrMasterData.findMany({
        where: { type: 'designations', status: 'ACTIVE' },
        select: { name: true },
        orderBy: [{ name: 'asc' }],
      }),
      prisma.employee.findMany({
        where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
        select: { employmentType: true, department: true, designation: true },
      }),
    ]);

    const departments = Array.from(
      new Set([...departmentRows.map((row) => row.name), ...employees.map((row) => row.department).filter(Boolean) as string[]]),
    ).sort();
    const designations = Array.from(
      new Set([...designationRows.map((row) => row.name), ...employees.map((row) => row.designation).filter(Boolean) as string[]]),
    ).sort();
    const employmentTypes = Array.from(
      new Set([...EMPLOYMENT_TYPE_OPTIONS, ...employees.map((row) => row.employmentType).filter(Boolean) as string[]]),
    ).sort();

    return Response.json(apiOk({ departments, designations, employmentTypes }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/salary-components/form-data failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 500 });
  }
}
