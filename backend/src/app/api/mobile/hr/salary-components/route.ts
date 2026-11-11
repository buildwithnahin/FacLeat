import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { SalaryComponentsService } from '@/server/services/salary-components.service';
import { salaryComponentFormSchema } from '@/server/validators/salary-components';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const sp = req.nextUrl.searchParams;
    const components = await SalaryComponentsService.getSalaryComponents(session, {
      search: sp.get('q') ?? undefined,
      category: sp.get('category') ?? undefined,
      type: sp.get('type') ?? undefined,
      status: sp.get('status') ?? undefined,
    });
    return Response.json(apiOk(components));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/salary-components failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const body = await req.json();
    const parsed = salaryComponentFormSchema.safeParse(body);
    if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });

    const component = await SalaryComponentsService.createSalaryComponent(session, parsed.data);
    return Response.json(apiOk(component));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/salary-components failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
