import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { hrService } from '@/server/services/hr.service';
import { employeeUpdateSchema } from '@/server/validators/hr';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });
  const { id } = await params;

  try {
    const e = await hrService.getEmployee(session, id);
    return Response.json(
      apiOk({
        id: e.id,
        branchId: e.branchId,
        code: e.code,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        phone: e.phone,
        designation: e.designation,
        department: e.department,
        employmentType: e.employmentType,
        shiftId: e.shiftId,
        reportingManagerId: e.reportingManagerId,
        systemRoleId: e.systemRoleId,
        joinedAt: e.joinedAt.toISOString(),
        status: e.status,
        basicSalary: e.basicSalary.toString(),
        houseAllowance: e.houseAllowance.toString(),
        transportAllowance: e.transportAllowance.toString(),
        medicalAllowance: e.medicalAllowance.toString(),
        otherAllowance: e.otherAllowance.toString(),
        providentFund: e.providentFund.toString(),
        taxDeduction: e.taxDeduction.toString(),
        bankName: e.bankName,
        bankAccount: e.bankAccount,
        branch: { id: e.branch.id, code: e.branch.code, name: e.branch.name },
        shift: e.shift ? { id: e.shift.id, name: e.shift.name, startTime: e.shift.startTime, endTime: e.shift.endTime } : null,
        reportingManager: e.reportingManager
          ? { id: e.reportingManager.id, firstName: e.reportingManager.firstName, lastName: e.reportingManager.lastName }
          : null,
        systemRole: e.systemRole ? { id: e.systemRole.id, name: e.systemRole.name } : null,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/employees/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = employeeUpdateSchema.safeParse({ ...(body ?? {}), id });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    await hrService.updateEmployee(session, parsed.data);
    return Response.json(apiOk({ id }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('PUT /api/mobile/hr/employees/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
