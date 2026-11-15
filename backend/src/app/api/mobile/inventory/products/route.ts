import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { productService } from '@/server/services/product.service';
import { productCreateSchema } from '@/server/validators/products';
import { ApiError } from '@/lib/errors';
import type { Prisma } from '@prisma/client';

const PRODUCT_TYPES = ['RAW_MATERIAL', 'WORK_IN_PROGRESS', 'FINISHED_GOOD', 'CONSUMABLE', 'SERVICE'] as const;

function parseTypeFilter(sp: URLSearchParams): Prisma.ProductWhereInput['type'] {
  const type = sp.get('type');
  if (type && (PRODUCT_TYPES as readonly string[]).includes(type)) {
    return type as (typeof PRODUCT_TYPES)[number];
  }
  const section = sp.get('section');
  switch (section) {
    case 'raw-material':
      return 'RAW_MATERIAL';
    case 'work-in-progress':
      return 'WORK_IN_PROGRESS';
    case 'finished-goods':
      return 'FINISHED_GOOD';
    case 'consumables':
      return { in: ['CONSUMABLE', 'SERVICE'] };
    default:
      return undefined;
  }
}

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const activeOnly = sp.get('activeOnly') === 'true';
  const branchId = sp.get('branchId') || session.activeBranchId || undefined;

  try {
    const products = await productService.list(session, {
      type: parseTypeFilter(sp),
      branchId,
    });
    const filtered = activeOnly ? products.filter((p) => p.isActive) : products;
    return Response.json(
      apiOk(
        filtered.map((p) => ({
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
          availableQty: p.availableQty.toString(),
          isActive: p.isActive,
          imageUrl: p.imageUrl,
        })),
      ),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/inventory/products failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = productCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const product = await productService.create(session, parsed.data);
    return Response.json(apiOk(product), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/inventory/products failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
