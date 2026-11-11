import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { hrService } from '@/server/services/hr.service';
import { holidaysService } from '@/server/services/holidays.service';
import { attendanceMarkSchema } from '@/server/validators/hr';
import { attendanceEngineService } from '@/server/services/attendance-engine.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const dateStr = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const day = new Date(dateStr);

  try {
    const [employees, records, holidays] = await Promise.all([
      hrService.listEmployees(session, { status: 'ACTIVE' }),
      hrService.listAttendance(session, { from: day, to: day }),
      holidaysService.listOnDate(session, day),
    ]);

    const byEmp = new Map(records.map((r) => [r.employeeId, r]));

    return Response.json(
      apiOk({
        employees: employees.map((e) => {
          const r = byEmp.get(e.id);
          const holiday = holidays.find((h) => h.branchId === null || h.branchId === e.branchId);
          return {
            id: e.id,
            code: e.code,
            firstName: e.firstName,
            lastName: e.lastName,
            branchId: e.branchId,
            record: r
              ? {
                  id: r.id,
                  status: r.status,
                  checkIn: r.checkIn ? r.checkIn.toISOString() : null,
                  checkOut: r.checkOut ? r.checkOut.toISOString() : null,
                }
              : null,
            holiday: holiday ? { id: holiday.id, branchId: holiday.branchId } : null,
          };
        }),
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/attendance failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = attendanceMarkSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const record = await hrService.markAttendance(session, parsed.data);
    // Runs the automated attendance engine (late/early/OT computation) right
    // after a manual mark, same as the original Server Action did.
    await attendanceEngineService.processEmployeeDay(session, record.employeeId, record.date, record.checkIn, record.checkOut);
    return Response.json(apiOk({ id: record.id }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/attendance failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
