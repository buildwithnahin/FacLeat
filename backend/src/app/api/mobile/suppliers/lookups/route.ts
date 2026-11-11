import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { branchService } from '@/server/services/branch.service';
import { ApiError } from '@/lib/errors';

/**
 * Backs the branch picker on the supplier create/edit forms — before the
 * backend/web split this was a raw `prisma.branch.findMany` in the page
 * component. `listAccessible` requires only a session (no extra
 * permission gate beyond `suppliers:read`/`suppliers:write` already
 * enforced by the page's other calls), matching the original's unscoped
 * "active branches" list.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const branches = await branchService.listAccessible(session);
    return Response.json(
      apiOk({
        branches: branches.map((b) => ({ id: b.id, name: b.name, code: b.code, currency: b.currency })),
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/suppliers/lookups failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
