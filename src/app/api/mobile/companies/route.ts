import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { companyService } from '@/server/services/company.service';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const companies = await companyService.listAll(session);
    return Response.json(
      apiOk(companies.map((c) => ({ id: c.id, name: c.name, code: c.code }))),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/companies failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
