import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { categoryService } from '@/server/services/product-category.service';
import { categoryCreateSchema } from '@/server/validators/product-categories';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const flat = req.nextUrl.searchParams.get('flat') === 'true';
  try {
    const categories = flat ? await categoryService.listFlat(session) : await categoryService.list(session);
    return Response.json(apiOk(categories));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/inventory/categories failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = categoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const category = await categoryService.create(session, parsed.data);
    return Response.json(apiOk(category), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/inventory/categories failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
