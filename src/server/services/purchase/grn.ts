import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';
import type { GrnCreateInput } from '@/server/validators/purchase';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { nextDocumentNumber } from '@/lib/document-number';
import { normalizeSize } from './shared';

export const grnMethods = {
  async listGrns(session: AppSession | null) {
    await authorize(session, 'purchase:read');
    return prisma.goodsReceiving.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        purchaseOrder: { select: { id: true, number: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        items: { select: { id: true } },
      },
    });
  },

  async getGrn(session: AppSession | null, id: string) {
    await authorize(session, 'purchase:read');
    const grn = await prisma.goodsReceiving.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        purchaseOrder: true,
        items: {
          include: {
            product: { select: { id: true, sku: true, name: true, unit: true } },
            purchaseOrderItem: { select: { id: true, orderedQty: true, receivedQty: true } },
          },
        },
      },
    });
    if (!grn) throw new NotFoundError('GRN not found');
    return grn;
  },

  async createGrn(session: AppSession | null, input: GrnCreateInput) {
    const actor = await authorize(session, 'purchase:receive');

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: input.purchaseOrderId },
      include: { items: true, supplier: true },
    });
    if (!po) throw new NotFoundError('Purchase order not found');
    if (po.status !== 'APPROVED' && po.status !== 'PARTIALLY_RECEIVED') {
      throw new ValidationError(`Cannot receive goods on PO in ${po.status} state`);
    }
    const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse || warehouse.branchId !== po.branchId) {
      throw new ValidationError('Warehouse does not belong to this branch');
    }

    const poItemById = new Map(po.items.map((i) => [i.id, i]));

    return prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const yearCount = await tx.goodsReceiving.count({
        where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      });
      const number = nextDocumentNumber('GRN', year, yearCount);

      const grn = await tx.goodsReceiving.create({
        data: {
          branchId: po.branchId,
          number,
          purchaseOrderId: po.id,
          supplierId: po.supplierId,
          warehouseId: input.warehouseId,
          status: 'COMPLETED',
          receivedDate: input.receivedDate,
          receivedById: actor.userId,
          notes: input.notes || null,
        },
      });

      let totalReceived = 0;
      for (const item of input.items) {
        const poItem = poItemById.get(item.purchaseOrderItemId);
        if (!poItem) throw new ValidationError('Invalid PO item');
        const receivedQty = new Prisma.Decimal(item.receivedQty);
        if (receivedQty.lte(0)) continue;

        const remaining = poItem.orderedQty.minus(poItem.receivedQty);
        if (receivedQty.gt(remaining)) {
          throw new ValidationError(
            `Received qty ${receivedQty.toString()} exceeds remaining ${remaining.toString()} for product ${poItem.productId}`,
          );
        }

        await tx.goodsReceivingItem.create({
          data: {
            grnId: grn.id,
            purchaseOrderItemId: poItem.id,
            productId: poItem.productId,
            size: normalizeSize(item.size) ?? poItem.size,
            receivedQty,
            rejectedQty: new Prisma.Decimal(item.rejectedQty),
            unitCost: new Prisma.Decimal(item.unitCost),
            note: item.note || null,
          },
        });

        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { receivedQty: poItem.receivedQty.plus(receivedQty) },
        });

        // Inventory ledger IN (golden rule: no inventory without GRN)
        await tx.inventoryLedger.create({
          data: {
            branchId: po.branchId,
            warehouseId: input.warehouseId,
            productId: poItem.productId,
            direction: 'IN',
            quantity: receivedQty,
            costPerUnit: new Prisma.Decimal(item.unitCost),
            refType: 'GRN',
            refId: grn.id,
            note: `${number} (${po.number})`,
            createdById: actor.userId,
          },
        });

        totalReceived += 1;
      }

      // Recompute PO status
      const refreshedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: po.id },
      });
      const allReceived = refreshedItems.every((i) => i.receivedQty.gte(i.orderedQty));
      const anyReceived = refreshedItems.some((i) => i.receivedQty.gt(0));
      const newStatus = allReceived
        ? 'COMPLETED'
        : anyReceived
          ? 'PARTIALLY_RECEIVED'
          : po.status;
      if (newStatus !== po.status) {
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: { status: newStatus },
        });
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: po.branchId,
          module: 'purchase',
          action: 'grn.create',
          entityType: 'GoodsReceiving',
          entityId: grn.id,
          after: {
            number,
            poNumber: po.number,
            warehouseId: input.warehouseId,
            itemsPosted: totalReceived,
          },
        },
        tx,
      );

      return grn;
    });
  },
};
