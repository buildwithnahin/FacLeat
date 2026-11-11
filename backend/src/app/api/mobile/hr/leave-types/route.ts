import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { leaveTypesService } from '@/server/services/leave-types.service';
import { leaveTypeCreateSchema } from '@/server/validators/leave-types';

const EMPLOYMENT_TYPE_OPTIONS = ['PERMANENT', 'PROBATION', 'INTERNSHIP', 'CONTRACTUAL', 'WORKER', 'STAFF', 'MANAGEMENT'];

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = sp.get('q') ?? '';

  try {
    await authorize(session, 'hr:read');

    const [leaveTypes, branches, departmentRows, designationRows, employees] = await Promise.all([
      leaveTypesService.list(session, q),
      prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: [{ code: 'asc' }],
      }),
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

    return Response.json(apiOk({ leaveTypes, branches, departments, designations, employmentTypes }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/leave-types failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = leaveTypeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const data = await leaveTypesService.create(session, parsed.data);
    return Response.json(apiOk(data), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/leave-types failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
