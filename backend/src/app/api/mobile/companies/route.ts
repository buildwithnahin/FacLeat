import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { companyService } from '@/server/services/company.service';
import { companyCreateSchema } from '@/server/validators/companies';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const companies = await companyService.listAll(session);
    // `full=1` is for the Companies MANAGEMENT page (needs every editable
    // field); the default trimmed shape stays as-is because
    // `<CompanySwitcher>` already depends on it.
    if (req.nextUrl.searchParams.get('full') === '1') {
      return Response.json(apiOk(companies));
    }
    return Response.json(
      apiOk(companies.map((c) => ({ id: c.id, name: c.name, code: c.code }))),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/companies failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = companyCreateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const company = await companyService.create(session, parsed.data);
    return Response.json(apiOk(company), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/companies failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
