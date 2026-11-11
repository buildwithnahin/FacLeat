import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { branchService } from '@/server/services/branch.service';
import { branchCreateSchema } from '@/server/validators/branches';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const activeOnly = req.nextUrl.searchParams.get('activeOnly') === 'true';
    const branches = activeOnly
      ? await branchService.listActive(session)
      : await branchService.listAll(session);
    // `full=1` is for the Branches MANAGEMENT page (needs every editable
    // field); the default trimmed shape stays as-is because
    // `<BranchSwitcher>` already depends on it.
    if (req.nextUrl.searchParams.get('full') === '1') {
      return Response.json(apiOk(branches));
    }
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

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = branchCreateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const branch = await branchService.create(session, parsed.data);
    return Response.json(apiOk(branch), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/branches failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
