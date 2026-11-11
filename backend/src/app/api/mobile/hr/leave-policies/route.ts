import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { leavePoliciesService } from '@/server/services/leave-policies.service';
import { leaveTypesService } from '@/server/services/leave-types.service';
import { leavePolicyCreateSchema } from '@/server/validators/leave-policies';

const EMPLOYMENT_TYPE_OPTIONS = ['PERMANENT', 'PROBATION', 'INTERNSHIP', 'CONTRACTUAL', 'WORKER', 'STAFF', 'MANAGEMENT'];

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'hr:read');

    const [policies, assignableEmployees, branches, departmentRows, designationRows, leaveTypes] = await Promise.all([
      leavePoliciesService.list(session),
      leavePoliciesService.listAssignableEmployees(session),
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
      leaveTypesService.listActive(session),
    ]);

    const departments = Array.from(
      new Set([...departmentRows.map((row) => row.name), ...assignableEmployees.map((emp) => emp.department).filter(Boolean) as string[]]),
    ).sort();
    const designations = Array.from(
      new Set([...designationRows.map((row) => row.name), ...assignableEmployees.map((emp) => emp.designation).filter(Boolean) as string[]]),
    ).sort();
    const employmentTypes = Array.from(
      new Set([...EMPLOYMENT_TYPE_OPTIONS, ...assignableEmployees.map((emp) => emp.employmentType).filter(Boolean) as string[]]),
    ).sort();

    return Response.json(
      apiOk({ policies, assignableEmployees, branches, departments, designations, employmentTypes, leaveTypes }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/leave-policies failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = leavePolicyCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const data = await leavePoliciesService.create(session, parsed.data);
    return Response.json(apiOk(data), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/leave-policies failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
