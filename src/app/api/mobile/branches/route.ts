import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { branchService } from '@/server/services/branch.service';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const branches = await branchService.listAll(session);
    return Response.json(
      apiOk(
        branches.map((b) => ({
          id: b.id,
          name: b.name,
          code: b.code,
          companyId: b.companyId,
          currency: b.currency,
        })),
      ),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/branches failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
