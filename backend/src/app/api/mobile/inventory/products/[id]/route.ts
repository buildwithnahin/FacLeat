import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { productService } from '@/server/services/product.service';
import { productUpdateSchema } from '@/server/validators/products';
import { ApiError } from '@/lib/errors';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const p = await productService.getById(session, id);
    return Response.json(
      apiOk({
        id: p.id,
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        description: p.description,
        size: p.size,
        type: p.type,
        unit: p.unit,
        categoryId: p.categoryId,
        category: p.category ? { id: p.category.id, name: p.category.name } : null,
        brandId: p.brandId,
        brand: p.brand ? { id: p.brand.id, name: p.brand.name } : null,
        costPrice: p.costPrice.toString(),
        sellPrice: p.sellPrice.toString(),
        taxRate: p.taxRate.toString(),
        reorderLevel: p.reorderLevel.toString(),
        reorderQty: p.reorderQty.toString(),
        isActive: p.isActive,
        imageUrl: p.imageUrl,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/inventory/products/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = productUpdateSchema.safeParse({ ...(body ?? {}), id });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const product = await productService.update(session, parsed.data);
    return Response.json(apiOk(product));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('PATCH /api/mobile/inventory/products/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
