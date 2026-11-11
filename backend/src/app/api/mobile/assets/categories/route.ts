import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { assetService } from '@/server/services/asset.service';
import { assetCategorySchema } from '@/server/validators/assets';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const data = await assetService.listCategories(session);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/assets/categories failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

/** Upsert: body carrying an `id` updates that category, otherwise creates a new one. */
export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id, ...rest } = (body ?? {}) as { id?: string };
  const parsed = assetCategorySchema.safeParse(rest);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const data = await assetService.upsertCategory(session, parsed.data, id || undefined);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/assets/categories failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
