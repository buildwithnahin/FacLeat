import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { ApiError } from '@/lib/errors';

/**
 * No dedicated brand.service exists (root's product-new/edit pages query
 * prisma.productBrand directly) — kept as a direct, read-only, company-scoped
 * lookup here rather than inventing a service around a single findMany.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'inventory:read');
    const brands = await prisma.productBrand.findMany({
      where: { companyId: session.activeCompanyId ?? undefined },
      orderBy: { name: 'asc' },
    });
    return Response.json(apiOk(brands));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/inventory/brands failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
