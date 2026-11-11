import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { accountsService } from '@/server/services/accounts.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const branchId = req.nextUrl.searchParams.get('branchId') ?? session.activeBranchId ?? '';
  if (!branchId) return Response.json(apiOk([]));

  try {
    const contacts = await accountsService.listContactsForBranch(session, branchId);
    return Response.json(apiOk(contacts));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/accounts/contacts failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
