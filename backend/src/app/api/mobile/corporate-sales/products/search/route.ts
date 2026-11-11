import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { assertBranchInScope } from '@/server/auth/data-scope';
import { prisma } from '@/server/db';

/**
 * Ported from the pre-split root's `/api/corporate-sales/search` route
 * handler (same query/scoping logic) — powers both the builder pages'
 * initial product grid and the `LineItemsEditor`'s live search box.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const branchId = req.nextUrl.searchParams.get('branchId') ?? session.activeBranchId;
  if (!branchId) return Response.json(apiOk([]));

  try {
    await authorize(session, 'corporate-sales:read');
    const branch = await assertBranchInScope(session, branchId);

    const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
    const where = q
      ? {
          isActive: true,
          companyId: branch.companyId,
          OR: [
            { sku: { equals: q } },
            { barcode: { equals: q } },
            { name: { contains: q } },
            { sku: { contains: q } },
          ],
        }
      : { isActive: true, companyId: branch.companyId };

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 40,
      select: {
        id: true,
        sku: true,
        barcode: true,
        name: true,
        unit: true,
        sellPrice: true,
        taxRate: true,
        imageUrl: true,
      },
    });
    return Response.json(apiOk(products));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/corporate-sales/products/search failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
