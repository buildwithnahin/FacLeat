import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { payrollReportsService } from '@/server/services/payroll-reports.service';
import { recruitmentReportsService } from '@/server/services/recruitment-reports.service';
import { lifecycleReportsService } from '@/server/services/lifecycle-reports.service';
import { leaveReportsService } from '@/server/services/leave-reports.service';
import { employeeReportsService } from '@/server/services/employee-reports.service';
import { attendanceReportsService } from '@/server/services/attendance-reports.service';
import type { AppSession } from '@/server/auth/session';

type RouteParams = { params: Promise<{ category: string; type: string }> };

type ReportCenterService = {
  getReportCenter: (session: AppSession | null, filters: Record<string, unknown>) => Promise<unknown>;
};

const HR_CATEGORY_MAP: Record<string, ReportCenterService> = {
  payroll: payrollReportsService,
  recruitment: recruitmentReportsService,
  lifecycle: lifecycleReportsService,
  leave: leaveReportsService,
  employee: employeeReportsService,
  attendance: attendanceReportsService,
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { category, type } = await params;
  const service = HR_CATEGORY_MAP[category];
  if (!service) {
    return Response.json(apiError('Unknown report category'), { status: 404 });
  }

  const filters: Record<string, unknown> = { reportType: type.toUpperCase() };
  req.nextUrl.searchParams.forEach((value, key) => {
    filters[key] = value;
  });

  try {
    const data = await service.getReportCenter(session, filters);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`GET /api/mobile/reports/hr/${category}/${type} failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
