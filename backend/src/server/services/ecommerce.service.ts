import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { assertOpenPeriod } from '@/server/periods/guards';
import { publishToPermission } from '@/server/notifications/publisher';
import { assertBranchInScope, getScopedBranchIds } from '@/server/auth/data-scope';
import type { AppSession } from '@/server/auth/session';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { nextDocumentNumber } from '@/lib/document-number';

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const ZERO = new Prisma.Decimal(0);

export interface EcommerceOrderItemInput {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountRate?: number;
  taxRate?: number;
}

export interface SyncOrderInput {
  branchId: string;
  warehouseId?: string;
  channelCode: string;
  channelName: string;
  channelType?: 'SHOPIFY' | 'WOOCOMMERCE' | 'FACEBOOK' | 'DARAZ' | 'MANUAL' | 'OTHER';
  externalId: string;
  orderDate?: Date;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  shipToAddress?: string;
  shippingTotal?: number;
  paidTotal?: number;
  notes?: string;
  items: EcommerceOrderItemInput[];
}

export interface FulfillOrderInput {
  orderId: string;
  warehouseId: string;
  courier?: string;
  trackingNo?: string;
  delivered?: boolean;
}

export interface ReturnOrderInput {
  orderId: string;
  refundMethod: 'CASH' | 'CARD' | 'MOBILE_BANKING' | 'BANK_TRANSFER' | 'CREDIT' | 'GIFT_CARD' | 'OTHER';
  reason?: string;
  items: { orderItemId: string; quantity: number }[];
}

export interface ReconcileInput {
  branchId: string;
  channelId: string;
  periodStart: Date;
  periodEnd: Date;
  settlements: {
    externalOrderId: string;
    amount: number;
    fee?: number;
    provider?: string;
    externalPaymentId?: string;
    receivedAt?: Date;
  }[];
}

function computeLine(input: EcommerceOrderItemInput) {
  const qty = D(input.quantity);
  const price = D(input.unitPrice);
  const gross = qty.mul(price);
  const discount = gross.mul(D(input.discountRate ?? 0)).div(100);
  const net = gross.minus(discount);
  const tax = net.mul(D(input.taxRate ?? 0)).div(100);
  return { gross, discount, tax, lineTotal: net.plus(tax) };
}

async function assertStockAvailable(
  tx: Prisma.TransactionClient,
  branchId: string,
  warehouseId: string,
  items: { productId: string; quantity: Prisma.Decimal }[],
) {
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  if (productIds.length === 0) return;

  const ledgerAgg = await tx.inventoryLedger.groupBy({
    by: ['productId', 'direction'],
    where: { branchId, warehouseId, productId: { in: productIds } },
    _sum: { quantity: true },
  });

  const balanceByProduct = new Map<string, Prisma.Decimal>();
  for (const row of ledgerAgg) {
    const prev = balanceByProduct.get(row.productId) ?? ZERO;
    const delta = row._sum.quantity ? new Prisma.Decimal(row._sum.quantity) : ZERO;
    balanceByProduct.set(row.productId, row.direction === 'IN' ? prev.plus(delta) : prev.minus(delta));
  }

  const needed = new Map<string, Prisma.Decimal>();
  for (const item of items) {
    needed.set(item.productId, (needed.get(item.productId) ?? ZERO).plus(item.quantity));
  }
  for (const [productId, qty] of needed) {
    const balance = balanceByProduct.get(productId) ?? ZERO;
    if (balance.lt(qty)) {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { sku: true } });
      throw new ValidationError(
        `Insufficient stock for ${product?.sku ?? productId}: have ${balance.toString()}, need ${qty.toString()}`,
      );
    }
  }
}

export const ecommerceService = {
  async dashboard(session: AppSession | null, branchId?: string) {
    await authorize(session, 'ecommerce:read');
    const [open, packed, shipped, returns, unreconciled] = await Promise.all([
      prisma.ecommerceOrder.count({ where: { branchId, status: { in: ['SYNCED', 'PACKING'] } } }),
      prisma.ecommerceOrder.count({ where: { branchId, status: 'PACKED' } }),
      prisma.ecommerceOrder.count({ where: { branchId, status: { in: ['SHIPPED', 'DELIVERED'] } } }),
      prisma.ecommerceReturn.count({ where: { branchId, status: { in: ['REQUESTED', 'RECEIVED'] } } }),
      prisma.ecommerceOrder.count({
        where: { branchId, paymentStatus: { in: ['PAID', 'PARTIALLY_PAID'] }, reconciledAmount: { equals: 0 } },
      }),
    ]);
    return { open, packed, shipped, returns, unreconciled };
  },

  async listChannels(session: AppSession | null, branchId?: string) {
    await authorize(session, 'ecommerce:read');
    return prisma.ecommerceChannel.findMany({
      where: { branchId, isActive: true },
      orderBy: { name: 'asc' },
    });
  },

  async listReconciliationRuns(session: AppSession | null, branchId?: string) {
    await authorize(session, 'ecommerce:read');
    return prisma.ecommerceReconciliationRun.findMany({
      where: { branchId },
      include: { channel: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  },

  async listOrders(
    session: AppSession | null,
    filters: { branchId?: string; status?: string; search?: string } = {},
  ) {
    await authorize(session, 'ecommerce:read');
    const branchIds = await getScopedBranchIds(session, filters.branchId);
    return prisma.ecommerceOrder.findMany({
      where: {
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
        status: filters.status as Prisma.EcommerceOrderWhereInput['status'],
        OR: filters.search
          ? [
              { number: { contains: filters.search } },
              { customerName: { contains: filters.search } },
              { customerPhone: { contains: filters.search } },
              { externalId: { contains: filters.search } },
            ]
          : undefined,
      },
      orderBy: { orderDate: 'desc' },
      take: 100,
      include: {
        channel: true,
        warehouse: { select: { id: true, code: true, name: true } },
        items: true,
        payments: true,
        returns: true,
      },
    });
  },

  async getOrder(session: AppSession | null, id: string) {
    await authorize(session, 'ecommerce:read');
    const order = await prisma.ecommerceOrder.findUnique({
      where: { id },
      include: {
        channel: true,
        warehouse: true,
        items: { include: { product: true } },
        fulfillments: { include: { items: true }, orderBy: { createdAt: 'desc' } },
        payments: { orderBy: { receivedAt: 'desc' } },
        returns: { include: { items: true }, orderBy: { receivedAt: 'desc' } },
      },
    });
    if (!order) throw new NotFoundError('E-commerce order not found');
    return order;
  },

  async syncOrder(session: AppSession | null, input: SyncOrderInput) {
    const actor = await authorize(session, 'ecommerce:sync');
    if (input.items.length === 0) throw new ValidationError('At least one order item is required');

    const branch = await prisma.branch.findUnique({ where: { id: input.branchId } });
    if (!branch) throw new NotFoundError('Branch not found');
    if (input.warehouseId) {
      const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
      if (!warehouse || warehouse.branchId !== input.branchId) {
        throw new ValidationError('Warehouse does not belong to this branch');
      }
    }

    const skus = input.items.map((i) => i.sku);
    const products = await prisma.product.findMany({
      where: { OR: [{ sku: { in: skus } }, { barcode: { in: skus } }] },
      select: { id: true, sku: true, barcode: true, unit: true },
    });
    const productByCode = new Map<string, (typeof products)[number]>();
    for (const product of products) {
      productByCode.set(product.sku, product);
      if (product.barcode) productByCode.set(product.barcode, product);
    }

    let subtotal = ZERO;
    let discountTotal = ZERO;
    let taxTotal = ZERO;
    const itemRows = input.items.map((item) => {
      const computed = computeLine(item);
      const product = productByCode.get(item.sku);
      subtotal = subtotal.plus(computed.gross);
      discountTotal = discountTotal.plus(computed.discount);
      taxTotal = taxTotal.plus(computed.tax);
      return {
        productId: product?.id ?? null,
        sku: item.sku,
        name: item.name,
        unit: product?.unit ?? 'PCS',
        quantity: D(item.quantity),
        unitPrice: D(item.unitPrice),
        discountRate: D(item.discountRate ?? 0),
        taxRate: D(item.taxRate ?? 0),
        lineTotal: computed.lineTotal,
      };
    });
    const shippingTotal = D(input.shippingTotal ?? 0);
    const grandTotal = subtotal.minus(discountTotal).plus(taxTotal).plus(shippingTotal);
    const paidTotal = D(input.paidTotal ?? 0);

    const order = await prisma.$transaction(async (tx) => {
      const channel = await tx.ecommerceChannel.upsert({
        where: { branchId_code: { branchId: input.branchId, code: input.channelCode } },
        update: {
          name: input.channelName,
          type: input.channelType ?? 'MANUAL',
          lastSyncAt: new Date(),
        },
        create: {
          branchId: input.branchId,
          code: input.channelCode,
          name: input.channelName,
          type: input.channelType ?? 'MANUAL',
          lastSyncAt: new Date(),
        },
      });

      const existing = await tx.ecommerceOrder.findUnique({
        where: { channelId_externalId: { channelId: channel.id, externalId: input.externalId } },
        include: { fulfillments: true },
      });
      if (existing?.fulfillments.length) {
        throw new ValidationError('Cannot overwrite an order that already has fulfillment activity');
      }

      const year = new Date().getFullYear();
      const count = await tx.ecommerceOrder.count({ where: { branchId: input.branchId } });
      const number = existing?.number ?? nextDocumentNumber('ECOM', year, count, 6);

      if (existing) {
        await tx.ecommercePayment.deleteMany({ where: { orderId: existing.id } });
        await tx.ecommerceOrderItem.deleteMany({ where: { orderId: existing.id } });
      }

      const saved = existing
        ? await tx.ecommerceOrder.update({
            where: { id: existing.id },
            data: {
              warehouseId: input.warehouseId ?? null,
              orderDate: input.orderDate ?? existing.orderDate,
              subtotal,
              discountTotal,
              shippingTotal,
              taxTotal,
              grandTotal,
              paidTotal,
              paymentStatus: paidTotal.gte(grandTotal) ? 'PAID' : paidTotal.gt(ZERO) ? 'PARTIALLY_PAID' : 'PENDING',
              customerName: input.customerName || null,
              customerPhone: input.customerPhone || null,
              customerEmail: input.customerEmail || null,
              shipToAddress: input.shipToAddress || null,
              notes: input.notes || null,
              items: { create: itemRows },
              payments: paidTotal.gt(ZERO)
                ? {
                    create: [{
                      branchId: input.branchId,
                      method: 'OTHER',
                      provider: channel.name,
                      amount: paidTotal,
                      createdById: actor.userId,
                    }],
                  }
                : undefined,
            },
          })
        : await tx.ecommerceOrder.create({
            data: {
              channelId: channel.id,
              branchId: input.branchId,
              warehouseId: input.warehouseId ?? null,
              externalId: input.externalId,
              number,
              orderDate: input.orderDate ?? new Date(),
              currency: branch.currency,
              subtotal,
              discountTotal,
              shippingTotal,
              taxTotal,
              grandTotal,
              paidTotal,
              paymentStatus: paidTotal.gte(grandTotal) ? 'PAID' : paidTotal.gt(ZERO) ? 'PARTIALLY_PAID' : 'PENDING',
              customerName: input.customerName || null,
              customerPhone: input.customerPhone || null,
              customerEmail: input.customerEmail || null,
              shipToAddress: input.shipToAddress || null,
              notes: input.notes || null,
              createdById: actor.userId,
              items: { create: itemRows },
              payments: paidTotal.gt(ZERO)
                ? {
                    create: [{
                      branchId: input.branchId,
                      method: 'OTHER',
                      provider: channel.name,
                      amount: paidTotal,
                      createdById: actor.userId,
                    }],
                  }
                : undefined,
            },
          });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.branchId,
          module: 'ecommerce',
          action: existing ? 'order-resync' : 'order-sync',
          entityType: 'EcommerceOrder',
          entityId: saved.id,
          after: { number: saved.number, externalId: input.externalId, grandTotal: grandTotal.toString() },
        },
        tx,
      );

      return saved;
    });

    await publishToPermission('ecommerce:read', {
      branchId: input.branchId,
      severity: 'INFO',
      module: 'ecommerce',
      title: `Online order synced: ${order.number}`,
      body: `${input.channelName} order ${input.externalId}`,
      href: '/ecommerce',
    });
    return order;
  },

  async packOrder(session: AppSession | null, orderId: string) {
    const actor = await authorize(session, 'ecommerce:fulfill');
    return prisma.$transaction(async (tx) => {
      const order = await tx.ecommerceOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new NotFoundError('E-commerce order not found');
      if (order.status === 'CANCELLED' || order.status === 'RETURNED') {
        throw new ValidationError(`Cannot pack a ${order.status.toLowerCase()} order`);
      }

      await Promise.all(
        order.items.map((item) =>
          tx.ecommerceOrderItem.update({
            where: { id: item.id },
            data: { packedQty: item.quantity },
          }),
        ),
      );
      const updated = await tx.ecommerceOrder.update({
        where: { id: order.id },
        data: { status: 'PACKED' },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: order.branchId,
          module: 'ecommerce',
          action: 'pack',
          entityType: 'EcommerceOrder',
          entityId: order.id,
          after: { number: order.number },
        },
        tx,
      );
      return updated;
    });
  },

  async fulfillOrder(session: AppSession | null, input: FulfillOrderInput) {
    const actor = await authorize(session, 'ecommerce:fulfill');
    const order = await prisma.ecommerceOrder.findUnique({
      where: { id: input.orderId },
      include: { items: { include: { product: true } }, branch: true },
    });
    if (!order) throw new NotFoundError('E-commerce order not found');
    if (order.status === 'CANCELLED' || order.status === 'RETURNED') {
      throw new ValidationError(`Cannot fulfill a ${order.status.toLowerCase()} order`);
    }
    const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse || warehouse.branchId !== order.branchId) {
      throw new ValidationError('Warehouse does not belong to this branch');
    }
    const fulfillItems = order.items.map((item) => {
      if (!item.productId) throw new ValidationError(`Order item ${item.sku} is not linked to a product`);
      return {
        orderItemId: item.id,
        productId: item.productId,
        quantity: item.quantity.minus(item.fulfilledQty),
      };
    }).filter((item) => item.quantity.gt(ZERO));
    if (fulfillItems.length === 0) throw new ValidationError('Order has no remaining quantity to fulfill');

    const fulfilled = await prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, order.branchId);
      if (!order.branch.allowNegativeStock) {
        await assertStockAvailable(tx, order.branchId, input.warehouseId, fulfillItems);
      }

      const now = new Date();
      const fulfillment = await tx.ecommerceFulfillment.create({
        data: {
          orderId: order.id,
          branchId: order.branchId,
          warehouseId: input.warehouseId,
          status: input.delivered ? 'DELIVERED' : 'SHIPPED',
          packedAt: order.status === 'PACKED' ? undefined : now,
          shippedAt: now,
          deliveredAt: input.delivered ? now : null,
          courier: input.courier || null,
          trackingNo: input.trackingNo || null,
          createdById: actor.userId,
          items: {
            create: fulfillItems.map((item) => ({
              orderItemId: item.orderItemId,
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
      });

      for (const item of fulfillItems) {
        await tx.inventoryLedger.create({
          data: {
            branchId: order.branchId,
            warehouseId: input.warehouseId,
            productId: item.productId,
            direction: 'OUT',
            quantity: item.quantity,
            costPerUnit: ZERO,
            refType: 'ECOM_FULFILLMENT',
            refId: fulfillment.id,
            createdById: actor.userId,
          },
        });
        const current = order.items.find((i) => i.id === item.orderItemId)!;
        await tx.ecommerceOrderItem.update({
          where: { id: item.orderItemId },
          data: { fulfilledQty: current.fulfilledQty.plus(item.quantity) },
        });
      }

      const updated = await tx.ecommerceOrder.update({
        where: { id: order.id },
        data: {
          warehouseId: input.warehouseId,
          status: input.delivered ? 'DELIVERED' : 'SHIPPED',
          courier: input.courier || order.courier,
          trackingNo: input.trackingNo || order.trackingNo,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: order.branchId,
          module: 'ecommerce',
          action: 'fulfill',
          entityType: 'EcommerceFulfillment',
          entityId: fulfillment.id,
          after: { orderNumber: order.number, status: updated.status },
        },
        tx,
      );
      return updated;
    });

    await publishToPermission('ecommerce:read', {
      branchId: order.branchId,
      severity: 'INFO',
      module: 'ecommerce',
      title: `Online order fulfilled: ${order.number}`,
      body: input.trackingNo ? `Tracking ${input.trackingNo}` : undefined,
      href: '/ecommerce',
    });
    return fulfilled;
  },

  async returnOrder(session: AppSession | null, input: ReturnOrderInput) {
    const actor = await authorize(session, 'ecommerce:refund');
    const order = await prisma.ecommerceOrder.findUnique({
      where: { id: input.orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundError('E-commerce order not found');
    if (!order.warehouseId) throw new ValidationError('Order has no fulfillment warehouse');

    const itemMap = new Map(order.items.map((item) => [item.id, item]));
    const returnItems = input.items.map((item) => {
      const original = itemMap.get(item.orderItemId);
      if (!original) throw new ValidationError('Return item does not belong to this order');
      const qty = D(item.quantity);
      const remaining = original.fulfilledQty.minus(original.returnedQty);
      if (qty.lte(0) || qty.gt(remaining)) {
        throw new ValidationError(`Invalid return quantity for ${original.sku}`);
      }
      return {
        orderItemId: original.id,
        productId: original.productId,
        quantity: qty,
        lineTotal: original.lineTotal.div(original.quantity).mul(qty),
      };
    });
    const refundAmount = returnItems.reduce((sum, item) => sum.plus(item.lineTotal), ZERO);

    const ret = await prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, order.branchId);
      const created = await tx.ecommerceReturn.create({
        data: {
          orderId: order.id,
          branchId: order.branchId,
          status: 'REFUNDED',
          refundAmount,
          refundMethod: input.refundMethod,
          reason: input.reason || null,
          createdById: actor.userId,
          items: {
            create: returnItems.map((item) => ({
              orderItemId: item.orderItemId,
              productId: item.productId,
              quantity: item.quantity,
              lineTotal: item.lineTotal,
            })),
          },
        },
      });

      for (const item of returnItems) {
        if (item.productId) {
          await tx.inventoryLedger.create({
            data: {
              branchId: order.branchId,
              warehouseId: order.warehouseId!,
              productId: item.productId,
              direction: 'IN',
              quantity: item.quantity,
              costPerUnit: ZERO,
              refType: 'ECOM_RETURN',
              refId: created.id,
              createdById: actor.userId,
            },
          });
        }
        const original = itemMap.get(item.orderItemId)!;
        await tx.ecommerceOrderItem.update({
          where: { id: item.orderItemId },
          data: { returnedQty: original.returnedQty.plus(item.quantity) },
        });
      }

      const totalReturned = order.items.reduce((sum, item) => {
        const added = returnItems.find((r) => r.orderItemId === item.id)?.quantity ?? ZERO;
        return sum.plus(item.returnedQty).plus(added);
      }, ZERO);
      const totalQty = order.items.reduce((sum, item) => sum.plus(item.quantity), ZERO);
      await tx.ecommerceOrder.update({
        where: { id: order.id },
        data: {
          status: totalReturned.gte(totalQty) ? 'RETURNED' : 'PARTIALLY_RETURNED',
          paymentStatus: 'REFUNDED',
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: order.branchId,
          module: 'ecommerce',
          action: 'return-refund',
          entityType: 'EcommerceReturn',
          entityId: created.id,
          after: { orderNumber: order.number, refundAmount: refundAmount.toString() },
        },
        tx,
      );
      return created;
    });

    await publishToPermission('ecommerce:read', {
      branchId: order.branchId,
      severity: 'WARNING',
      module: 'ecommerce',
      title: `Online return refunded: ${order.number}`,
      body: refundAmount.toString(),
      href: '/ecommerce',
    });
    return ret;
  },

  async reconcilePayments(session: AppSession | null, input: ReconcileInput) {
    const actor = await authorize(session, 'ecommerce:reconcile');
    const channel = await prisma.ecommerceChannel.findUnique({ where: { id: input.channelId } });
    if (!channel || channel.branchId !== input.branchId) throw new NotFoundError('E-commerce channel not found');

    return prisma.$transaction(async (tx) => {
      let matchedCount = 0;
      let unmatchedCount = 0;
      let totalSettled = ZERO;

      for (const settlement of input.settlements) {
        const amount = D(settlement.amount);
        totalSettled = totalSettled.plus(amount);
        const order = await tx.ecommerceOrder.findUnique({
          where: {
            channelId_externalId: {
              channelId: input.channelId,
              externalId: settlement.externalOrderId,
            },
          },
        });
        if (!order) {
          unmatchedCount += 1;
          continue;
        }

        matchedCount += 1;
        await tx.ecommercePayment.create({
          data: {
            orderId: order.id,
            branchId: order.branchId,
            method: 'OTHER',
            provider: settlement.provider || channel.name,
            externalId: settlement.externalPaymentId || null,
            amount,
            fee: D(settlement.fee ?? 0),
            receivedAt: settlement.receivedAt ?? new Date(),
            reconciledAt: new Date(),
            status: 'RECONCILED',
            createdById: actor.userId,
          },
        });

        const reconciledAmount = order.reconciledAmount.plus(amount);
        await tx.ecommerceOrder.update({
          where: { id: order.id },
          data: {
            reconciledAmount,
            paymentStatus: reconciledAmount.gte(order.grandTotal) ? 'RECONCILED' : order.paymentStatus,
          },
        });
      }

      const run = await tx.ecommerceReconciliationRun.create({
        data: {
          branchId: input.branchId,
          channelId: input.channelId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          status: 'COMPLETED',
          matchedCount,
          unmatchedCount,
          totalSettled,
          createdById: actor.userId,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.branchId,
          module: 'ecommerce',
          action: 'payment-reconcile',
          entityType: 'EcommerceReconciliationRun',
          entityId: run.id,
          after: { matchedCount, unmatchedCount, totalSettled: totalSettled.toString() },
        },
        tx,
      );
      return run;
    });
  },
};
