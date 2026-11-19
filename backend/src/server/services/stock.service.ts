import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { assertBranchInScope, getScopedBranchIds } from '@/server/auth/data-scope';
import { recordAudit } from '@/server/audit/logger';
import { assertOpenPeriod } from '@/server/periods/guards';
import { publishToPermission } from '@/server/notifications/publisher';
import type { AppSession } from '@/server/auth/session';
import {
  matchesInventorySection,
  type InventorySectionSlug,
} from '@/lib/inventory-sections';
import { NotFoundError, ValidationError } from '@/lib/errors';

export type MovementItem = {
  productId: string;
  quantity: string; // decimal string
  costPerUnit?: string; // decimal string; optional for OUT flows
  note?: string;
};

export type ReceiptInput = {
  branchId: string;
  warehouseId: string;
  refType: string; // 'OPENING' | 'MANUAL_ADJUST' on the manual UI; formal flows (GRN, returns) write InventoryLedger directly with their own refType
  refId?: string;
  note?: string;
  items: MovementItem[];
};

export type IssueInput = {
  branchId: string;
  warehouseId: string;
  refType: string; // 'CONSUMPTION' | 'MANUAL_ADJUST' on the manual UI; formal flows (sales, damage) write InventoryLedger directly with their own refType
  refId?: string;
  note?: string;
  items: MovementItem[];
};

export type TransferInput = {
  branchId: string; // UI context; source/destination branches are inferred from the warehouses
  fromWarehouseId: string;
  toWarehouseId: string;
  note?: string;
  items: MovementItem[];
};

export type PhysicalCountInput = {
  branchId: string;
  warehouseId: string;
  note?: string;
  items: { productId: string; countedQuantity: string; costPerUnit?: string }[];
};

type BalanceRow = { productId: string; warehouseId: string; balance: Prisma.Decimal };

export type DetailedBalanceRow = {
  product: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    type: import('@prisma/client').ProductType;
    reorderLevel: Prisma.Decimal;
    costPrice: Prisma.Decimal;
    sellPrice: Prisma.Decimal;
  };
  warehouse: {
    id: string;
    name: string;
    code: string;
    type: import('@prisma/client').WarehouseType;
  };
  qty: Prisma.Decimal;
};

function assertPositiveItems(items: MovementItem[]) {
  if (items.length === 0) throw new ValidationError('At least one item is required');
  for (const it of items) {
    if (!it.productId) throw new ValidationError('Missing product');
    const q = new Prisma.Decimal(it.quantity || 0);
    if (q.lte(0)) throw new ValidationError('Each quantity must be greater than zero');
  }
}

async function getBalances(
  tx: Prisma.TransactionClient | typeof prisma,
  branchFilter?: string | string[],
  warehouseId?: string,
  productIds?: string[],
): Promise<BalanceRow[]> {
  const params: unknown[] = [];
  let where = '1=1';
  if (Array.isArray(branchFilter)) {
    const valid = branchFilter.filter((b) => b && typeof b === 'string' && b.trim());
    if (valid.length > 0) {
      where += ` AND \`branchId\` IN (${valid.map(() => '?').join(', ')})`;
      params.push(...valid);
    }
  } else if (branchFilter && typeof branchFilter === 'string' && branchFilter.trim()) {
    params.push(branchFilter.trim());
    where += ' AND `branchId` = ?';
  }
  if (warehouseId && typeof warehouseId === 'string' && warehouseId.trim()) {
    params.push(warehouseId.trim());
    where += ' AND `warehouseId` = ?';
  }
  if (productIds && productIds.length > 0) {
    where += ` AND \`productId\` IN (${productIds.map(() => '?').join(', ')})`;
    params.push(...productIds);
  }
  const rows = await tx.$queryRawUnsafe<BalanceRow[]>(
    `SELECT \`productId\`, \`warehouseId\`,
            CAST(SUM(CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END) AS DECIMAL(18,4)) AS balance
       FROM \`InventoryLedger\`
      WHERE ${where}
      GROUP BY \`productId\`, \`warehouseId\``,
    ...params,
  );
  return rows.map((r) => ({
    productId: r.productId,
    warehouseId: r.warehouseId,
    balance: new Prisma.Decimal(r.balance ?? 0),
  }));
}

async function notifyLowStockProducts(branchId: string, productIds: string[]) {
  const uniqueIds = Array.from(new Set(productIds));
  if (uniqueIds.length === 0) return;

  const [balances, products] = await Promise.all([
    getBalances(prisma, branchId, undefined, uniqueIds),
    prisma.product.findMany({
      where: {
        id: { in: uniqueIds },
        isActive: true,
        reorderLevel: { gt: 0 },
      },
      select: { id: true, sku: true, name: true, unit: true, reorderLevel: true },
    }),
  ]);

  const totals = new Map<string, Prisma.Decimal>();
  for (const row of balances) {
    totals.set(row.productId, (totals.get(row.productId) ?? new Prisma.Decimal(0)).plus(row.balance));
  }

  for (const product of products) {
    const qty = totals.get(product.id) ?? new Prisma.Decimal(0);
    if (qty.lte(product.reorderLevel)) {
      await publishToPermission('inventory:read', {
        branchId,
        severity: qty.lte(0) ? 'CRITICAL' : 'WARNING',
        module: 'inventory',
        title: `Low stock: ${product.sku}`,
        body: `${product.name} is at ${qty.toString()} ${product.unit}; reorder level is ${product.reorderLevel.toString()}.`,
        href: '/reports/inventory',
      });
    }
  }
}

async function assertProductsInCompany(session: AppSession | null, productIds: string[]) {
  if (!session?.activeCompanyId || productIds.length === 0) return;

  const products = await prisma.product.findMany({
    where: { id: { in: Array.from(new Set(productIds)) } },
    select: { id: true, companyId: true },
  });
  if (products.length !== Array.from(new Set(productIds)).length) {
    throw new NotFoundError('One or more products were not found');
  }
  const invalid = products.find((product) => product.companyId !== session.activeCompanyId);
  if (invalid) throw new ValidationError('Product does not belong to the active company');
}

export const stockService = {
  async balanceSnapshot(session: AppSession | null, branchId: string, warehouseId?: string) {
    await authorize(session, 'inventory:read');
    await assertBranchInScope(session, branchId);
    return getBalances(prisma, branchId, warehouseId);
  },

  async balanceSnapshotDetailed(
    session: AppSession | null,
    filters: {
      branchId?: string;
      warehouseId?: string;
      warehouseType?: import('@prisma/client').WarehouseType | 'ALL';
      section?: InventorySectionSlug | null;
    },
  ): Promise<DetailedBalanceRow[]> {
    await authorize(session, 'inventory:read');
    const branchIds = await getScopedBranchIds(session, filters.branchId);
    if (filters.branchId && branchIds && branchIds.length === 0) return [];

    const effectiveBranchFilter = filters.branchId && filters.branchId.trim()
      ? filters.branchId.trim()
      : (branchIds && branchIds.length > 0 ? branchIds : undefined);

    const [balances, warehouses, products] = await Promise.all([
      getBalances(prisma, effectiveBranchFilter, filters.warehouseId),
      prisma.warehouse.findMany({
        where: {
          ...(effectiveBranchFilter ? (Array.isArray(effectiveBranchFilter) ? { branchId: { in: effectiveBranchFilter } } : { branchId: effectiveBranchFilter }) : {}),
          ...(filters.warehouseId ? { id: filters.warehouseId } : {}),
          ...(filters.warehouseType && filters.warehouseType !== 'ALL' ? { type: filters.warehouseType } : {}),
        },
        select: { id: true, name: true, code: true, type: true },
      }),
      prisma.product.findMany({
        where: session?.activeCompanyId ? { companyId: session.activeCompanyId } : undefined,
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          reorderLevel: true,
          type: true,
          costPrice: true,
          sellPrice: true,
        },
      }),
    ]);

    const whById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
    const prodById = new Map(products.map((product) => [product.id, product]));

    const rows: DetailedBalanceRow[] = [];
    for (const balance of balances) {
      const product = prodById.get(balance.productId);
      const warehouse = whById.get(balance.warehouseId);
      if (!product || !warehouse) continue;
      if (
        filters.section &&
        !matchesInventorySection({
          section: filters.section,
          productType: product.type,
          warehouseType: warehouse.type,
        })
      ) {
        continue;
      }
      rows.push({
        product,
        warehouse,
        qty: balance.balance,
      });
    }

    rows.sort((a, b) => {
      const byProduct = a.product.name.localeCompare(b.product.name);
      if (byProduct !== 0) return byProduct;
      return a.warehouse.name.localeCompare(b.warehouse.name);
    });

    return rows;
  },

  async listMovements(
    session: AppSession | null,
    filters: {
      branchId?: string;
      warehouseId?: string;
      productId?: string;
      direction?: 'IN' | 'OUT';
      refType?: string;
      from?: Date;
      to?: Date;
      limit?: number;
      section?: InventorySectionSlug | null;
    },
  ) {
    await authorize(session, 'inventory:read');
    const branchIds = await getScopedBranchIds(session, filters.branchId);
    const rows = await prisma.inventoryLedger.findMany({
      where: {
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
        warehouseId: filters.warehouseId,
        productId: filters.productId,
        direction: filters.direction,
        refType: filters.refType,
        createdAt: {
          gte: filters.from,
          lte: filters.to,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 200,
      include: {
        product: { select: { sku: true, name: true, unit: true, type: true, companyId: true } },
        warehouse: { select: { code: true, name: true, type: true } },
      },
    });

    const companyScopedRows = session?.activeCompanyId
      ? rows.filter((row) => row.product.companyId === session.activeCompanyId)
      : rows;

    if (!filters.section) return companyScopedRows;

    return companyScopedRows.filter((row) =>
      matchesInventorySection({
        section: filters.section!,
        productType: row.product.type,
        warehouseType: row.warehouse.type,
      }),
    );
  },

  async postReceipt(session: AppSession | null, input: ReceiptInput) {
    const actor = await authorize(session, 'warehouse:receive');
    assertPositiveItems(input.items);
    await assertBranchInScope(actor, input.branchId);
    await assertProductsInCompany(actor, input.items.map((it) => it.productId));
    const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse || warehouse.branchId !== input.branchId) {
      throw new ValidationError('Warehouse does not belong to this branch');
    }

    const result = await prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, input.branchId);

      const created = await Promise.all(
        input.items.map((it) =>
          tx.inventoryLedger.create({
            data: {
              branchId: input.branchId,
              warehouseId: input.warehouseId,
              productId: it.productId,
              direction: 'IN',
              quantity: new Prisma.Decimal(it.quantity),
              costPerUnit: new Prisma.Decimal(it.costPerUnit ?? '0'),
              refType: input.refType,
              refId: input.refId ?? null,
              note: it.note ?? input.note ?? null,
              createdById: actor.userId,
            },
          }),
        ),
      );
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.branchId,
          module: 'warehouse',
          action: 'receive',
          entityType: 'InventoryLedger',
          entityId: null,
          after: {
            warehouseId: input.warehouseId,
            refType: input.refType,
            refId: input.refId ?? null,
            itemCount: input.items.length,
            totalQty: input.items
              .reduce((acc, it) => acc.plus(new Prisma.Decimal(it.quantity)), new Prisma.Decimal(0))
              .toString(),
          },
        },
        tx,
      );
      return { count: created.length };
    });
    await notifyLowStockProducts(input.branchId, input.items.map((it) => it.productId));
    return result;
  },

  async postIssue(session: AppSession | null, input: IssueInput) {
    const actor = await authorize(session, 'warehouse:issue');
    assertPositiveItems(input.items);
    await assertBranchInScope(actor, input.branchId);
    await assertProductsInCompany(actor, input.items.map((it) => it.productId));

    const warehouse = await prisma.warehouse.findUnique({
      where: { id: input.warehouseId },
      include: { branch: { select: { allowNegativeStock: true } } },
    });
    if (!warehouse || warehouse.branchId !== input.branchId) {
      throw new ValidationError('Warehouse does not belong to this branch');
    }

    const result = await prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, input.branchId);

      const productIds = input.items.map((it) => it.productId);
      const balances = await getBalances(tx, input.branchId, input.warehouseId, productIds);
      const balanceByProduct = new Map(balances.map((b) => [b.productId, b.balance]));

      if (!warehouse.branch.allowNegativeStock) {
        for (const it of input.items) {
          const current = balanceByProduct.get(it.productId) ?? new Prisma.Decimal(0);
          const qty = new Prisma.Decimal(it.quantity);
          if (current.minus(qty).lt(0)) {
            const prod = await tx.product.findUnique({
              where: { id: it.productId },
              select: { sku: true },
            });
            throw new ValidationError(
              `Insufficient stock for ${prod?.sku ?? it.productId}: have ${current.toString()}, need ${qty.toString()}`,
            );
          }
        }
      }

      const created = await Promise.all(
        input.items.map((it) =>
          tx.inventoryLedger.create({
            data: {
              branchId: input.branchId,
              warehouseId: input.warehouseId,
              productId: it.productId,
              direction: 'OUT',
              quantity: new Prisma.Decimal(it.quantity),
              costPerUnit: new Prisma.Decimal(it.costPerUnit ?? '0'),
              refType: input.refType,
              refId: input.refId ?? null,
              note: it.note ?? input.note ?? null,
              createdById: actor.userId,
            },
          }),
        ),
      );

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.branchId,
          module: 'warehouse',
          action: 'issue',
          entityType: 'InventoryLedger',
          entityId: null,
          after: {
            warehouseId: input.warehouseId,
            refType: input.refType,
            refId: input.refId ?? null,
            itemCount: input.items.length,
          },
        },
        tx,
      );
      return { count: created.length };
    });
    await notifyLowStockProducts(input.branchId, input.items.map((it) => it.productId));
    return result;
  },

  async postTransfer(session: AppSession | null, input: TransferInput) {
    const actor = await authorize(session, 'warehouse:transfer');
    assertPositiveItems(input.items);
    await assertBranchInScope(actor, input.branchId);
    await assertProductsInCompany(actor, input.items.map((it) => it.productId));
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new ValidationError('Source and destination warehouses must differ');
    }

    const [from, to] = await Promise.all([
      prisma.warehouse.findUnique({
        where: { id: input.fromWarehouseId },
        include: { branch: { select: { allowNegativeStock: true } } },
      }),
      prisma.warehouse.findUnique({ where: { id: input.toWarehouseId } }),
    ]);
    if (!from || !to) throw new NotFoundError('Warehouse not found');
    await assertBranchInScope(actor, from.branchId);
    await assertBranchInScope(actor, to.branchId);

    const result = await prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, from.branchId);
      if (from.branchId !== to.branchId) {
        await assertOpenPeriod(tx, to.branchId);
      }

      const productIds = input.items.map((it) => it.productId);
      const [balances, products] = await Promise.all([
        getBalances(tx, from.branchId, input.fromWarehouseId, productIds),
        tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, costPrice: true },
        }),
      ]);
      const balanceByProduct = new Map(balances.map((b) => [b.productId, b.balance]));
      const costMap = new Map(products.map((p) => [p.id, p.costPrice]));

      if (!from.branch.allowNegativeStock) {
        for (const it of input.items) {
          const current = balanceByProduct.get(it.productId) ?? new Prisma.Decimal(0);
          const qty = new Prisma.Decimal(it.quantity);
          if (current.minus(qty).lt(0)) {
            throw new ValidationError(
              `Insufficient stock in source warehouse for product ${it.productId}: have ${current.toString()}, need ${qty.toString()}`,
            );
          }
        }
      }

      const refId = `TRN-${Date.now()}`;
      await Promise.all(
        input.items.flatMap((it) => {
          const unitCost =
            it.costPerUnit && Number(it.costPerUnit) > 0
              ? new Prisma.Decimal(it.costPerUnit)
              : (costMap.get(it.productId) ?? new Prisma.Decimal(0));

          return [
            tx.inventoryLedger.create({
              data: {
                branchId: from.branchId,
                warehouseId: input.fromWarehouseId,
                productId: it.productId,
                direction: 'OUT',
                quantity: new Prisma.Decimal(it.quantity),
                costPerUnit: unitCost,
                refType: 'TRANSFER',
                refId,
                note: input.note ?? null,
                createdById: actor.userId,
              },
            }),
            tx.inventoryLedger.create({
              data: {
                branchId: to.branchId,
                warehouseId: input.toWarehouseId,
                productId: it.productId,
                direction: 'IN',
                quantity: new Prisma.Decimal(it.quantity),
                costPerUnit: unitCost,
                refType: 'TRANSFER',
                refId,
                note: input.note ?? null,
                createdById: actor.userId,
              },
            }),
          ];
        }),
      );

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: from.branchId,
          module: 'warehouse',
          action: 'transfer',
          entityType: 'InventoryLedger',
          entityId: null,
          after: {
            refId,
            fromBranchId: from.branchId,
            toBranchId: to.branchId,
            fromWarehouseId: input.fromWarehouseId,
            toWarehouseId: input.toWarehouseId,
            itemCount: input.items.length,
          },
        },
        tx,
      );

      return { refId, count: input.items.length };
    });
    await notifyLowStockProducts(from.branchId, input.items.map((it) => it.productId));
    return result;
  },

  async postPhysicalCount(session: AppSession | null, input: PhysicalCountInput) {
    const actor = await authorize(session, 'warehouse:count');
    if (input.items.length === 0) throw new ValidationError('No items counted');
    await assertBranchInScope(actor, input.branchId);
    await assertProductsInCompany(actor, input.items.map((it) => it.productId));

    const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse || warehouse.branchId !== input.branchId) {
      throw new ValidationError('Warehouse does not belong to this branch');
    }

    const result = await prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, input.branchId);

      const productIds = input.items.map((i) => i.productId);
      const [balances, products] = await Promise.all([
        getBalances(tx, input.branchId, input.warehouseId, productIds),
        tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, costPrice: true },
        }),
      ]);
      const balanceByProduct = new Map(balances.map((b) => [b.productId, b.balance]));
      const costMap = new Map(products.map((p) => [p.id, p.costPrice]));

      const refId = `PC-${Date.now()}`;
      let adjustmentsPosted = 0;

      for (const it of input.items) {
        const counted = new Prisma.Decimal(it.countedQuantity);
        if (counted.lt(0)) throw new ValidationError('Counted quantity cannot be negative');
        const current = balanceByProduct.get(it.productId) ?? new Prisma.Decimal(0);
        const delta = counted.minus(current);
        if (delta.eq(0)) continue;

        const unitCost =
          it.costPerUnit && Number(it.costPerUnit) > 0
            ? new Prisma.Decimal(it.costPerUnit)
            : (costMap.get(it.productId) ?? new Prisma.Decimal(0));

        await tx.inventoryLedger.create({
          data: {
            branchId: input.branchId,
            warehouseId: input.warehouseId,
            productId: it.productId,
            direction: delta.gt(0) ? 'IN' : 'OUT',
            quantity: delta.abs(),
            costPerUnit: unitCost,
            refType: 'PHYSICAL_COUNT',
            refId,
            note: input.note ?? null,
            createdById: actor.userId,
          },
        });
        adjustmentsPosted += 1;
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.branchId,
          module: 'warehouse',
          action: 'count',
          entityType: 'InventoryLedger',
          entityId: null,
          after: {
            refId,
            warehouseId: input.warehouseId,
            itemsCounted: input.items.length,
            adjustmentsPosted,
          },
        },
        tx,
      );

      return { refId, adjustmentsPosted, itemsCounted: input.items.length };
    });
    await notifyLowStockProducts(input.branchId, input.items.map((it) => it.productId));
    return result;
  },
};
