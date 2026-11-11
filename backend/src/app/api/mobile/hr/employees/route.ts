import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { hrService } from '@/server/services/hr.service';
import { employeeCreateSchema } from '@/server/validators/hr';

/**
 * Full employee list — backs the `hr/employees` list page (status,
 * branch{code,name}, systemRole{name}) and doubles as the employee-picker
 * lookup used across HR lifecycle forms (promotions, increments, transfers,
 * confirmations, resignations, contracts, joining), which only read a
 * subset of these fields.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const sp = req.nextUrl.searchParams;
    const employees = await hrService.listEmployees(session, {
      branchId: sp.get('branchId') ?? undefined,
      status: sp.get('status') ?? undefined,
      q: sp.get('q') ?? undefined,
    });
    return Response.json(
      apiOk(
        employees.map((e) => ({
          id: e.id,
          code: e.code,
          firstName: e.firstName,
          lastName: e.lastName,
          department: e.department,
          designation: e.designation,
          status: e.status,
          branchId: e.branchId,
          branchName: e.branch?.name ?? null,
          branch: e.branch ? { code: e.branch.code, name: e.branch.name } : null,
          shiftId: e.shiftId,
          shiftName: e.shift?.name ?? null,
          systemRole: e.systemRole ? { name: e.systemRole.name } : null,
          basicSalary: e.basicSalary.toString(),
          houseAllowance: e.houseAllowance.toString(),
          transportAllowance: e.transportAllowance.toString(),
          medicalAllowance: e.medicalAllowance.toString(),
          otherAllowance: e.otherAllowance.toString(),
        })),
      ),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/employees failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = employeeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const employee = await hrService.createEmployee(session, parsed.data);
    return Response.json(apiOk({ id: employee.id }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/employees failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
