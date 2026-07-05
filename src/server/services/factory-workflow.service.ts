import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { assertOpenPeriod } from '@/server/periods/guards';
import type { AppSession } from '@/server/auth/session';
import type {
  FinishedGoodsReceiveCreateInput,
  ProcessTrackingCreateInput,
  ProductionIssueCreateInput,
  ProductionIssueStatusInput,
  ProductionReceiveCreateInput,
} from '@/server/validators/factory';
import { NotFoundError, ValidationError } from '@/lib/errors';

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

async function inventoryBalanceFor(
  tx: Prisma.TransactionClient,
  branchId: string,
  warehouseId: string,
  productId: string,
) {
  const rows = await tx.$queryRaw<{ balance: number | null }[]>`
    SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END), 0)::numeric AS balance
      FROM "InventoryLedger"
     WHERE "branchId" = ${branchId}
       AND "warehouseId" = ${warehouseId}
       AND "productId" = ${productId}
  `;
  return D(rows[0]?.balance ?? 0);
}

async function nextVoucherNumber(prefix: string, model: 'productionIssueVoucher' | 'finishedGoodsReceiveVoucher') {
  const year = new Date().getFullYear();
  const where = {
    createdAt: {
      gte: new Date(year, 0, 1),
      lt: new Date(year + 1, 0, 1),
    },
  };
  const counter =
    model === 'productionIssueVoucher'
      ? await prisma.productionIssueVoucher.count({ where })
      : await prisma.finishedGoodsReceiveVoucher.count({ where });
  return `${prefix}-${year}-${String(counter + 1).padStart(5, '0')}`;
}

function parseDateTimeInput(raw?: string | null) {
  if (!raw) return null;
  const value = new Date(raw);
  return Number.isNaN(value.getTime()) ? null : value;
}

export const factoryWorkflowService = {
  async listProductionIssues(session: AppSession | null, branchId?: string) {
    await authorize(session, 'factory:read');
    return prisma.productionIssueVoucher.findMany({
      where: { branchId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { id: true, number: true, product: { select: { name: true, sku: true } } } },
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
        requestedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        issuedBy: { select: { id: true, name: true, email: true } },
      },
    });
  },

  async createProductionIssue(session: AppSession | null, input: ProductionIssueCreateInput) {
    const actor = await authorize(session, 'factory:execute');
    const order = await prisma.productionOrder.findUnique({
      where: { id: input.orderId },
      include: {
        branch: { select: { allowNegativeStock: true } },
        materials: true,
      },
    });
    if (!order) throw new NotFoundError('Production order not found');

    const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse || warehouse.branchId !== order.branchId) {
      throw new ValidationError('Selected RM warehouse does not belong to the order branch');
    }

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, order.branchId);
      const voucherNo = await nextVoucherNumber('PI', 'productionIssueVoucher');

      for (const item of input.items) {
        if (!order.branch.allowNegativeStock) {
          const balance = await inventoryBalanceFor(tx, order.branchId, input.warehouseId, item.productId);
          if (balance.lt(item.issuedQty)) {
            throw new ValidationError(`Insufficient RM stock for selected item. Available ${balance.toString()}, need ${item.issuedQty}`);
          }
        }
      }

      const created = await tx.productionIssueVoucher.create({
        data: {
          voucherNo,
          date: input.date,
          branchId: order.branchId,
          orderId: order.id,
          warehouseId: input.warehouseId,
          status: 'DRAFT',
          requestedById: actor.userId,
          remarks: input.remarks || null,
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              batchNo: item.batchNo || null,
              lotNo: item.lotNo || null,
              requiredQty: D(item.requiredQty),
              issuedQty: D(item.issuedQty),
              uom: item.uom,
            })),
          },
        },
        include: { items: true },
      });

      await recordAudit({
        actorId: actor.userId,
        branchId: order.branchId,
        module: 'factory',
        action: 'production-issue-create',
        entityType: 'ProductionIssueVoucher',
        entityId: created.id,
        after: { voucherNo: created.voucherNo, items: input.items.length, status: created.status },
      }, tx);

      return created;
    });
  },

  async changeProductionIssueStatus(session: AppSession | null, input: ProductionIssueStatusInput) {
    const actor = await authorize(session, 'factory:execute');
    const voucher = await prisma.productionIssueVoucher.findUnique({
      where: { id: input.voucherId },
      include: { items: true, order: true },
    });
    if (!voucher) throw new NotFoundError('Production issue voucher not found');

    return prisma.$transaction(async (tx) => {
      let updated;
      if (input.status === 'ISSUED') {
        if (!['APPROVED', 'REQUESTED'].includes(voucher.status)) {
          throw new ValidationError('Only approved/requested issue vouchers can be marked as issued');
        }
        await assertOpenPeriod(tx, voucher.branchId);

        for (const item of voucher.items) {
          await tx.inventoryLedger.create({
            data: {
              branchId: voucher.branchId,
              warehouseId: voucher.warehouseId,
              productId: item.productId,
              direction: 'OUT',
              quantity: item.issuedQty,
              refType: 'PRODUCTION_ISSUE',
              refId: voucher.id,
              note: `Production issue ${voucher.voucherNo}`,
              createdById: actor.userId,
            },
          });

          await tx.wipLedger.create({
            data: {
              date: voucher.date,
              branchId: voucher.branchId,
              orderId: voucher.orderId,
              productId: item.productId,
              voucher: voucher.voucherNo,
              inQty: item.issuedQty,
              balance: item.issuedQty,
              operatorId: null,
            },
          });
        }
      }

      updated = await tx.productionIssueVoucher.update({
        where: { id: voucher.id },
        data: {
          status: input.status,
          requestedById: input.status === 'REQUESTED' ? actor.userId : voucher.requestedById,
          approvedById: input.status === 'APPROVED' ? actor.userId : voucher.approvedById,
          issuedById: input.status === 'ISSUED' ? actor.userId : voucher.issuedById,
        },
      });

      await recordAudit({
        actorId: actor.userId,
        branchId: voucher.branchId,
        module: 'factory',
        action: 'production-issue-status',
        entityType: 'ProductionIssueVoucher',
        entityId: voucher.id,
        before: { status: voucher.status },
        after: { status: updated.status },
      }, tx);

      return updated;
    });
  },

  async listProcessTrackings(session: AppSession | null, branchId?: string) {
    await authorize(session, 'factory:read');
    return prisma.processTracking.findMany({
      where: { branchId },
      orderBy: { updatedAt: 'desc' },
      include: {
        order: { select: { id: true, number: true } },
        product: { select: { id: true, name: true, sku: true } },
        stage: { select: { id: true, name: true, sequence: true } },
        operator: { select: { id: true, firstName: true, lastName: true, code: true } },
      },
    });
  },

  async saveProcessTracking(session: AppSession | null, input: ProcessTrackingCreateInput) {
    const actor = await authorize(session, 'factory:execute');
    const order = await prisma.productionOrder.findUnique({
      where: { id: input.orderId },
      include: {
        stages: { orderBy: { sequence: 'asc' } },
      },
    });
    if (!order) throw new NotFoundError('Production order not found');

    const stage = order.stages.find((row) => row.id === input.stageId);
    if (!stage) throw new ValidationError('Selected process does not belong to this production order');

    return prisma.$transaction(async (tx) => {
      const existing = input.trackingId
        ? await tx.processTracking.findUnique({ where: { id: input.trackingId } })
        : null;

      const startTime = parseDateTimeInput(input.startTime) ?? existing?.startTime ?? (input.status === 'RUNNING' && !existing ? new Date() : null);
      const endTime = parseDateTimeInput(input.endTime) ?? (input.status === 'COMPLETED' ? new Date() : existing?.endTime ?? null);
      const durationMinutes = startTime && endTime ? Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000)) : null;

      const payload = {
        orderId: order.id,
        branchId: order.branchId,
        productId: input.productId,
        stageId: input.stageId,
        batchNo: input.batchNo || null,
        machine: input.machine || null,
        operatorId: input.operatorId || null,
        status: input.status,
        startTime,
        endTime,
        durationMinutes,
        inputQty: D(input.inputQty),
        outputQty: D(input.outputQty),
        rejectedQty: D(input.rejectedQty),
        scrapQty: D(input.scrapQty),
        reworkQty: D(input.reworkQty),
        remainingQty: D(Math.max(0, input.inputQty - input.outputQty - input.rejectedQty - input.scrapQty)),
      };

      const tracking = existing
        ? await tx.processTracking.update({
            where: { id: existing.id },
            data: payload,
          })
        : await tx.processTracking.create({
            data: {
              trackingNo: `PT-${Date.now()}`,
              ...payload,
            },
          });

      await tx.productionStage.update({
        where: { id: stage.id },
        data: {
          status: input.status === 'RUNNING' ? 'IN_PROGRESS' : input.status === 'COMPLETED' ? 'COMPLETED' : stage.status,
          startedAt: stage.startedAt ?? startTime ?? undefined,
          completedAt: input.status === 'COMPLETED' ? (endTime ?? new Date()) : stage.completedAt,
        },
      });

      if (input.scrapQty > 0 && (!existing || D(existing.scrapQty).lt(input.scrapQty))) {
        const delta = existing ? D(input.scrapQty).minus(existing.scrapQty) : D(input.scrapQty);
        if (delta.gt(0)) {
          await tx.scrapLedger.create({
            data: {
              date: new Date(),
              branchId: order.branchId,
              orderId: order.id,
              stageId: stage.id,
              scrapType: 'PROCESS_TRACKING',
              operatorId: input.operatorId || null,
              qty: delta,
              notes: `Tracking ${tracking.trackingNo}`,
            },
          });
        }
      }

      await recordAudit({
        actorId: actor.userId,
        branchId: order.branchId,
        module: 'factory',
        action: existing ? 'process-tracking-update' : 'process-tracking-create',
        entityType: 'ProcessTracking',
        entityId: tracking.id,
        after: { trackingNo: tracking.trackingNo, status: tracking.status, stageId: tracking.stageId },
      }, tx);

      return tracking;
    });
  },

  async listProductionReceives(session: AppSession | null, branchId?: string) {
    await authorize(session, 'factory:read');
    const rows = await prisma.wipLedger.findMany({
      where: {
        branchId,
        voucher: { startsWith: 'PRCV-' },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        order: { select: { id: true, number: true } },
        product: { select: { id: true, name: true, sku: true } },
        stage: { select: { id: true, name: true, sequence: true } },
        operator: { select: { id: true, firstName: true, lastName: true, code: true } },
      },
    });
    return rows;
  },

  async createProductionReceive(session: AppSession | null, input: ProductionReceiveCreateInput) {
    const actor = await authorize(session, 'factory:execute');
    const order = await prisma.productionOrder.findUnique({
      where: { id: input.orderId },
      include: { stages: { orderBy: { sequence: 'asc' } } },
    });
    if (!order) throw new NotFoundError('Production order not found');

    const fromStage = order.stages.find((stage) => stage.id === input.fromStageId);
    const toStage = order.stages.find((stage) => stage.id === input.toStageId);
    if (!fromStage || !toStage) throw new ValidationError('Selected process stages are invalid');

    const voucherNo = `PRCV-${Date.now()}`;
    const transferQty = D(input.receivedQty).plus(input.rejectedQty).plus(input.scrapQty);

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, order.branchId);

      await tx.wipLedger.create({
        data: {
          date: input.date,
          branchId: order.branchId,
          orderId: order.id,
          stageId: fromStage.id,
          productId: input.productId,
          voucher: voucherNo,
          operatorId: input.operatorId || null,
          outQty: transferQty,
          balance: D(0),
          cost: D(0),
        },
      });

      await tx.wipLedger.create({
        data: {
          date: input.date,
          branchId: order.branchId,
          orderId: order.id,
          stageId: toStage.id,
          productId: input.productId,
          voucher: voucherNo,
          operatorId: input.operatorId || null,
          inQty: D(input.receivedQty),
          balance: D(input.receivedQty),
          cost: D(0),
        },
      });

      if (input.rejectedQty > 0 || input.scrapQty > 0) {
        await tx.scrapLedger.create({
          data: {
            date: input.date,
            branchId: order.branchId,
            orderId: order.id,
            stageId: fromStage.id,
            scrapType: 'PRODUCTION_RECEIVE',
            operatorId: input.operatorId || null,
            qty: D(input.rejectedQty).plus(input.scrapQty),
            notes: input.remarks || `Receive voucher ${voucherNo}`,
          },
        });
      }

      await tx.productionStage.update({
        where: { id: fromStage.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await tx.productionStage.update({
        where: { id: toStage.id },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
      });

      await recordAudit({
        actorId: actor.userId,
        branchId: order.branchId,
        module: 'factory',
        action: 'production-receive-create',
        entityType: 'WipLedger',
        entityId: voucherNo,
        after: {
          voucherNo,
          orderId: order.id,
          fromStageId: fromStage.id,
          toStageId: toStage.id,
          receivedQty: input.receivedQty,
        },
      }, tx);

      return voucherNo;
    });
  },

  async listFinishedGoodsReceives(session: AppSession | null, branchId?: string) {
    await authorize(session, 'factory:read');
    return prisma.finishedGoodsReceiveVoucher.findMany({
      where: { branchId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { id: true, number: true, product: { select: { name: true, sku: true } } } },
        warehouse: { select: { id: true, name: true, code: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        receivedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
    });
  },

  async createFinishedGoodsReceive(session: AppSession | null, input: FinishedGoodsReceiveCreateInput) {
    const actor = await authorize(session, 'factory:execute');
    const order = await prisma.productionOrder.findUnique({ where: { id: input.orderId } });
    if (!order) throw new NotFoundError('Production order not found');

    const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse || warehouse.branchId !== order.branchId) {
      throw new ValidationError('Selected FG warehouse does not belong to the order branch');
    }

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, order.branchId);
      const receiveNo = await nextVoucherNumber('FGR', 'finishedGoodsReceiveVoucher');

      const voucher = await tx.finishedGoodsReceiveVoucher.create({
        data: {
          receiveNo,
          date: input.date,
          branchId: order.branchId,
          orderId: order.id,
          warehouseId: input.warehouseId,
          receivedById: actor.userId,
          approvedById: input.items.every((item) => item.qualityStatus === 'PASSED') ? actor.userId : null,
          remarks: input.remarks || null,
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              batchNo: item.batchNo || null,
              quantity: D(item.quantity),
              uom: item.uom,
              qualityStatus: item.qualityStatus,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of voucher.items) {
        await tx.inventoryLedger.create({
          data: {
            branchId: order.branchId,
            warehouseId: input.warehouseId,
            productId: item.productId,
            direction: 'IN',
            quantity: item.quantity,
            refType: 'FINISHED_GOODS_RECEIVE',
            refId: voucher.id,
            note: `Finished goods receive ${voucher.receiveNo}`,
            createdById: actor.userId,
          },
        });

        await tx.wipLedger.create({
          data: {
            date: input.date,
            branchId: order.branchId,
            orderId: order.id,
            stageId: input.sourceStageId || null,
            productId: item.productId,
            voucher: voucher.receiveNo,
            outQty: item.quantity,
            balance: D(0),
            cost: D(0),
          },
        });
      }

      await recordAudit({
        actorId: actor.userId,
        branchId: order.branchId,
        module: 'factory',
        action: 'finished-goods-receive-create',
        entityType: 'FinishedGoodsReceiveVoucher',
        entityId: voucher.id,
        after: { receiveNo: voucher.receiveNo, warehouseId: voucher.warehouseId, items: voucher.items.length },
      }, tx);

      return voucher;
    });
  },
};
