import { NextRequest } from 'next/server';
import { getSession } from '@/server/auth/session';
import { wholesaleService } from '@/server/services/wholesale.service';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q') ?? '';
  const branchId = req.nextUrl.searchParams.get('branchId') ?? session.activeBranchId ?? undefined;
  const products = await wholesaleService.searchProducts(session, q, 40, branchId);
  return Response.json(
    products.map((p) => ({
      id: p.id,
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      unit: p.unit,
      sellPrice: p.sellPrice.toString(),
      taxRate: p.taxRate.toString(),
      imageUrl: p.imageUrl,
    })),
  );
}
