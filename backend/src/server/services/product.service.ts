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

async function generateUniqueBarcode(companyId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateBarcode();
    const collision = await prisma.product.findUnique({
      where: { companyId_barcode: { companyId, barcode: candidate } },
    });
    if (!collision) return candidate;
  }
  throw new ValidationError('Could not generate a unique barcode after 5 attempts');
}

function assertProductCompanyAccess(session: AppSession | null, companyId: string) {
  if (!session?.activeCompanyId) return;
  if (session.activeCompanyId !== companyId) {
    throw new NotFoundError('Product not found');
  }
}

async function loadCategoryForCompany(categoryId: string | null | undefined, companyId: string) {
  if (!categoryId) return null;
  const category = await prisma.productCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true, companyId: true },
  });
  if (!category || category.companyId !== companyId) {
    throw new ValidationError('Category does not belong to the active company');
  }
  return category;
}

async function assertBrandCompanyAccess(brandId: string | null | undefined, companyId: string) {
  if (!brandId) return;
  const brand = await prisma.productBrand.findUnique({
    where: { id: brandId },
    select: { id: true, companyId: true },
  });
  if (!brand || brand.companyId !== companyId) {
    throw new ValidationError('Brand does not belong to the active company');
  }
}

export const productService = {
  async list(
    session: AppSession | null,
    filters: { type?: Prisma.ProductWhereInput['type']; branchId?: string } = {},
  ) {
    await authorize(session, 'inventory:read');
    const branchId = filters.branchId ?? session?.activeBranchId ?? undefined;
    const companyId = session?.activeCompanyId ?? undefined;

    const [products, ledgerAgg] = await Promise.all([
      prisma.product.findMany({
        where: {
          companyId,
          type: filters.type,
        },
        orderBy: { createdAt: 'desc' },
        include: PRODUCT_INCLUDE,
      }),
      prisma.inventoryLedger.groupBy({
        by: ['productId', 'direction'],
        where: branchId
          ? { branchId }
          : companyId
            ? { branch: { companyId } }
            : undefined,
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
      where: { companyId: session?.activeCompanyId ?? undefined },
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
      where: {
        companyId: session?.activeCompanyId ?? undefined,
        barcode: { not: null },
        isActive: true,
      },
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
    assertProductCompanyAccess(actor, existing.companyId);
    if (existing.barcode) throw new ValidationError('Product already has a barcode');

    const candidate = await generateUniqueBarcode(existing.companyId);
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
    assertProductCompanyAccess(session, product.companyId);
    return product;
  },

  async create(session: AppSession | null, input: ProductCreateInput) {
    const actor = await authorize(session, 'inventory:write');
    if (!actor.activeCompanyId) throw new ValidationError('No active company selected');
    const companyId = actor.activeCompanyId;

    const dup = await prisma.product.findUnique({ where: { companyId_sku: { companyId, sku: input.sku } } });
    if (dup) throw new ValidationError('SKU already exists');
    let barcode = input.barcode || null;
    if (input.barcodeMode === 'generate') {
      barcode = await generateUniqueBarcode(companyId);
    } else if (!barcode) {
      throw new ValidationError('Barcode is required when manual mode is selected');
    }
    if (barcode) {
      const bDup = await prisma.product.findUnique({ where: { companyId_barcode: { companyId, barcode } } });
      if (bDup) throw new ValidationError('Barcode already in use');
    }
    const category = await loadCategoryForCompany(input.categoryId, companyId);
    await assertBrandCompanyAccess(input.brandId, companyId);
    if (isShoesCategory(category?.name) && !input.size?.trim()) {
      throw new ValidationError('Size is required for products in the Shoes category');
    }

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          companyId,
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
    assertProductCompanyAccess(actor, existing.companyId);

    if (input.sku !== existing.sku) {
      const dup = await prisma.product.findUnique({
        where: { companyId_sku: { companyId: existing.companyId, sku: input.sku } },
      });
      if (dup) throw new ValidationError('SKU already exists');
    }
    let barcode = input.barcode || null;
    if (input.barcodeMode === 'generate' && !existing.barcode) {
      barcode = await generateUniqueBarcode(existing.companyId);
    } else if (input.barcodeMode === 'manual' && !barcode) {
      throw new ValidationError('Barcode is required when manual mode is selected');
    } else if (existing.barcode && input.barcodeMode === 'generate') {
      barcode = existing.barcode;
    }
    if (barcode && barcode !== existing.barcode) {
      const bDup = await prisma.product.findUnique({
        where: { companyId_barcode: { companyId: existing.companyId, barcode } },
      });
      if (bDup) throw new ValidationError('Barcode already in use');
    }
    const category = await loadCategoryForCompany(input.categoryId, existing.companyId);
    await assertBrandCompanyAccess(input.brandId, existing.companyId);
    if (isShoesCategory(category?.name) && !input.size?.trim()) {
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
