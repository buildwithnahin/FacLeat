import { NextRequest } from 'next/server';
import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { assertBranchInScope } from '@/server/auth/data-scope';
import { prisma } from '@/server/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  await authorize(session, 'corporate-sales:read');
  const branchId = req.nextUrl.searchParams.get('branchId') ?? session.activeBranchId;
  if (!branchId) return Response.json([]);
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
