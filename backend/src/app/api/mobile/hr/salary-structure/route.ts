import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { SalaryStructuresService } from '@/server/services/salary-structures.service';
import { salaryStructureFormSchema } from '@/server/validators/salary-structures';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const sp = req.nextUrl.searchParams;
    const search = sp.get('q') ?? undefined;
    const status = sp.get('status') ?? undefined;
    const structures = await SalaryStructuresService.getSalaryStructures(session, { search, status });
    return Response.json(apiOk(structures));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/salary-structure failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const body = await req.json();
    const parsed = salaryStructureFormSchema.safeParse(body);
    if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });

    const structure = await SalaryStructuresService.createSalaryStructure(session, parsed.data);
    return Response.json(apiOk(structure));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/salary-structure failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
