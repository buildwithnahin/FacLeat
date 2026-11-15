import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { productService } from '@/server/services/product.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const companyId = sp.get('companyId') || session.activeCompanyId || undefined;
  const branchId = sp.get('branchId') || session.activeBranchId || undefined;
  const inStockOnly = sp.get('inStockOnly') === 'true';

  try {
    const data = await productService.listForBarcodePrint(session, {
      companyId,
      branchId,
      inStockOnly,
    });
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/barcode/products/print failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
