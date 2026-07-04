import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';
import type { ProductCreateInput, ProductUpdateInput } from '@/server/validators/products';
import { NotFoundError, ValidationError } from '@/lib/errors';

const PRODUCT_INCLUDE = {
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
} as const;

function isShoesCategory(name: string | null | undefined) {
  return name?.trim().toLowerCase() === 'shoes';
}

function generateBarcode(): string {
  // ANX-YYYYMMDD-RRRRRR (scanner-friendly ASCII). Uniqueness checked by caller.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
  return `ANX-${y}${m}${day}-${rand}`;
}

async function generateUniqueBarcode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateBarcode();
    const collision = await prisma.product.findUnique({ where: { barcode: candidate } });
    if (!collision) return candidate;
  }
  throw new ValidationError('Could not generate a unique barcode after 5 attempts');
}

export const productService = {
  async list(
    session: AppSession | null,
    filters: { type?: Prisma.ProductWhereInput['type'] } = {},
  ) {
    await authorize(session, 'inventory:read');
    const [products, ledgerAgg] = await Promise.all([
      prisma.product.findMany({
        where: {
          type: filters.type,
        },
        orderBy: { createdAt: 'desc' },
        include: PRODUCT_INCLUDE,
      }),
      prisma.inventoryLedger.groupBy({
        by: ['productId', 'direction'],
        _sum: { quantity: true },
      }),
    ]);

    // Build a map: productId → net available qty (IN - OUT)
    const qtyMap = new Map<string, Prisma.Decimal>();
    for (const row of ledgerAgg) {
      const current = qtyMap.get(row.productId) ?? new Prisma.Decimal(0);
      const delta = row._sum.quantity ?? new Prisma.Decimal(0);
      qtyMap.set(
        row.productId,
        row.direction === 'IN' ? current.plus(delta) : current.minus(delta),
      );
    }

    return products.map((p) => ({
      ...p,
      availableQty: qtyMap.get(p.id) ?? new Prisma.Decimal(0),
    }));
  },

  async listForBarcodeOverview(session: AppSession | null) {
    await authorize(session, 'barcode:read');
    return prisma.product.findMany({
      orderBy: [{ barcode: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        sku: true,
        barcode: true,
        name: true,
        size: true,
        unit: true,
      },
    });
  },

  async listForBarcodePrint(session: AppSession | null) {
    await authorize(session, 'barcode:print');
    return prisma.product.findMany({
      where: { barcode: { not: null }, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        sku: true,
        barcode: true,
        name: true,
        size: true,
        unit: true,
        category: { select: { name: true } },
        sellPrice: true,
      },
    });
  },

  async assignBarcode(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'barcode:generate');
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Product not found');
    if (existing.barcode) throw new ValidationError('Product already has a barcode');

    const candidate = await generateUniqueBarcode();
    return prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: { barcode: candidate },
        include: PRODUCT_INCLUDE,
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'barcode',
          action: 'generate',
          entityType: 'Product',
          entityId: updated.id,
          after: { barcode: candidate },
        },
        tx,
      );
      return updated;
    });
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'inventory:read');
    const product = await prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    if (!product) throw new NotFoundError('Product not found');
    return product;
  },

  async create(session: AppSession | null, input: ProductCreateInput) {
    const actor = await authorize(session, 'inventory:write');

    const dup = await prisma.product.findUnique({ where: { sku: input.sku } });
    if (dup) throw new ValidationError('SKU already exists');
    let barcode = input.barcode || null;
    if (input.barcodeMode === 'generate') {
      barcode = await generateUniqueBarcode();
    } else if (!barcode) {
      throw new ValidationError('Barcode is required when manual mode is selected');
    }
    if (barcode) {
      const bDup = await prisma.product.findUnique({ where: { barcode } });
      if (bDup) throw new ValidationError('Barcode already in use');
    }
    const category = input.categoryId
      ? await prisma.productCategory.findUnique({
          where: { id: input.categoryId },
          select: { name: true },
        })
      : null;
    if (isShoesCategory(category?.name) && !input.size.trim()) {
      throw new ValidationError('Size is required for products in the Shoes category');
    }

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sku: input.sku,
          barcode,
          name: input.name,
          description: input.description || null,
          size: input.size || null,
          type: input.type,
          unit: input.unit,
          categoryId: input.categoryId || null,
          brandId: input.brandId || null,
          costPrice: new Prisma.Decimal(input.costPrice),
          sellPrice: new Prisma.Decimal(input.sellPrice),
          taxRate: new Prisma.Decimal(input.taxRate),
          reorderLevel: new Prisma.Decimal(input.reorderLevel),
          reorderQty: new Prisma.Decimal(input.reorderQty),
          isActive: input.isActive,
          imageUrl: input.imageUrl || null,
        },
        include: PRODUCT_INCLUDE,
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'inventory',
          action: 'product.create',
          entityType: 'Product',
          entityId: product.id,
          after: { sku: product.sku, name: product.name, barcode: product.barcode },
        },
        tx,
      );
      return product;
    });
  },

  async update(session: AppSession | null, input: ProductUpdateInput) {
    const actor = await authorize(session, 'inventory:write');
    const existing = await prisma.product.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundError('Product not found');

    if (input.sku !== existing.sku) {
      const dup = await prisma.product.findUnique({ where: { sku: input.sku } });
      if (dup) throw new ValidationError('SKU already exists');
    }
    let barcode = input.barcode || null;
    if (input.barcodeMode === 'generate' && !existing.barcode) {
      barcode = await generateUniqueBarcode();
    } else if (input.barcodeMode === 'manual' && !barcode) {
      throw new ValidationError('Barcode is required when manual mode is selected');
    } else if (existing.barcode && input.barcodeMode === 'generate') {
      barcode = existing.barcode;
    }
    if (barcode && barcode !== existing.barcode) {
      const bDup = await prisma.product.findUnique({ where: { barcode } });
      if (bDup) throw new ValidationError('Barcode already in use');
    }
    const category = input.categoryId
      ? await prisma.productCategory.findUnique({
          where: { id: input.categoryId },
          select: { name: true },
        })
      : null;
    if (isShoesCategory(category?.name) && !input.size.trim()) {
      throw new ValidationError('Size is required for products in the Shoes category');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: input.id },
        data: {
          sku: input.sku,
          barcode,
          name: input.name,
          description: input.description || null,
          size: input.size || null,
          type: input.type,
          unit: input.unit,
          categoryId: input.categoryId || null,
          brandId: input.brandId || null,
          costPrice: new Prisma.Decimal(input.costPrice),
          sellPrice: new Prisma.Decimal(input.sellPrice),
          taxRate: new Prisma.Decimal(input.taxRate),
          reorderLevel: new Prisma.Decimal(input.reorderLevel),
          reorderQty: new Prisma.Decimal(input.reorderQty),
          isActive: input.isActive,
          imageUrl: input.imageUrl || null,
        },
        include: PRODUCT_INCLUDE,
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'inventory',
          action: 'product.update',
          entityType: 'Product',
          entityId: updated.id,
          before: {
            sku: existing.sku,
            name: existing.name,
            sellPrice: existing.sellPrice.toString(),
            isActive: existing.isActive,
          },
          after: {
            sku: updated.sku,
            name: updated.name,
            sellPrice: updated.sellPrice.toString(),
            isActive: updated.isActive,
          },
        },
        tx,
      );
      return updated;
    });
  },
};
